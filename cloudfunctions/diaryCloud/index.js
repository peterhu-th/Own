// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { action, payload } = event

  switch (action) {
    case 'publish':
      return await handlePublish(openId, payload)
    case 'update':
      return await handleUpdate(openId, payload)
    case 'getList':
      return await handleGetList(openId, payload)
    case 'getDetail':
      return await handleGetDetail(openId, payload)
    case 'getTreeHole':
      return await handleGetTreeHole(openId, payload)
    case 'toggleLike':
      return await handleToggleLike(openId, payload)
    case 'getLikedDiaries':
      return await handleGetLikedDiaries(openId, payload)
    case 'getOnThisDay':
      return await handleGetOnThisDay(openId, payload)
    case 'delete':
      return await handleDelete(openId, payload)
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function handleDelete(openId, payload) {
  const { id } = payload
  if (!id) return { success: false, msg: '参数错误' }

  const record = await db.collection('Diaries').doc(id).get().catch(() => null)
  if (!record || record.data.owner_id !== openId) {
    return { success: false, msg: '无权删除' }
  }

  try {
    await db.collection('Diaries').doc(id).remove()
    await db.collection('Comments').where({ diary_id: id }).remove()
    return { success: true }
  } catch (e) {
    return { success: false, msg: '删除失败' }
  }
}

async function handleUpdate(openId, payload) {
  const { id, content, media_list = [] } = payload
  if (!id) return { success: false, msg: '参数错误' }
  if (!content || !content.trim()) return { success: false, msg: '内容不能为空' }

  // 验证归属权
  const record = await db.collection('Diaries').doc(id).get().catch(() => null)
  if (!record || record.data.owner_id !== openId) {
    return { success: false, msg: '无权修改' }
  }

  try {
    await db.collection('Diaries').doc(id).update({
      data: {
        content,
        media_list,
        audio_path: payload.audio_path || null,
        visibility: payload.visibility !== undefined ? payload.visibility : record.data.visibility,
        update_time: Date.now()
      }
    })
    return { success: true }
  } catch (e) {
    return { success: false, msg: '修改失败' }
  }
}

async function handleGetDetail(openId, payload) {
  const { id } = payload
  if (!id) return { success: false, msg: '参数错误' }

  try {
    const withTimeout = (promise, ms = 2000) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Query Timeout')), ms))
    ])

    const diaryRes = await withTimeout(db.collection('Diaries').doc(id).get())
    
    // Use Promise.all to fetch comments and likes in parallel with timeout
    const [commentsRes, likeRes] = await Promise.all([
      withTimeout(db.collection('Comments').where({ diary_id: id }).orderBy('create_time', 'asc').get()).catch(() => ({ data: [] })),
      withTimeout(db.collection('Likes').where({ diary_id: id, user_id: openId || '' }).get()).catch(() => ({ data: [] }))
    ])
      
    const isLiked = likeRes.data.length > 0
    
    let anonymous_name = null
    let avatar_color = null
    if (diaryRes.data.visibility === 'public' && diaryRes.data.owner_id !== openId) {
      const userRes = await withTimeout(db.collection('Users').doc(diaryRes.data.owner_id).get()).catch(() => null)
      if (userRes && userRes.data) {
        anonymous_name = userRes.data.anonymous_name || '某同学'
        avatar_color = generateColorFromId(userRes.data._id)
      }
    }

    return { 
      success: true, 
      diary: {
        ...diaryRes.data,
        anonymous_name,
        avatar_color
      },
      comments: commentsRes.data,
      isLiked
    }
  } catch (e) {
    return { success: false, msg: '拉取详情失败' }
  }
}

async function handlePublish(openId, payload) {
  const { content, media_list = [], audio_path, is_backdated = false, custom_time } = payload
  if (!content || !content.trim()) {
    return { success: false, msg: '内容不能为空' }
  }
  
  const createTime = is_backdated && custom_time ? custom_time : Date.now()

  const res = await db.collection('Diaries').add({
    data: {
      owner_id: openId,
      content,
      media_list,
      audio_path: audio_path || null,
      is_backdated,
      visibility: payload.visibility || 'partner',
      create_time: createTime,
      update_time: Date.now()
    }
  })

  let actionText = '发布了一篇新日记'
  if (is_backdated && custom_time) {
    const d = new Date(custom_time + 8 * 3600 * 1000)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth()+1).padStart(2,'0')
    const date = String(d.getUTCDate()).padStart(2,'0')
    const h = String(d.getUTCHours()).padStart(2,'0')
    const min = String(d.getUTCMinutes()).padStart(2,'0')
    actionText = `补传了一篇 ${y}-${m}-${date} ${h}:${min} 的日记`
  }

  // Log activity
  await db.collection('ActivityLog').add({
    data: {
      user_id: openId,
      type: 'diary',
      action: actionText,
      target_id: res._id,
      timestamp: Date.now()
    }
  })

  return { success: true, diaryId: res._id }
}

async function handleGetList(openId, payload) {
  const { dateFilter, ownerFilter, page = 1, pageSize = 10 } = payload || {}
  
  // 先获取当前用户及其 partner_id
  const userRes = await db.collection('Users').doc(openId).get().catch(() => null)
  const partnerId = userRes ? userRes.data.partner_id : null
  
  let matchCondition = {}
  
  // 过滤所有人
  if (ownerFilter === 'me') {
    matchCondition.owner_id = openId
  } else if (ownerFilter === 'partner' && partnerId) {
    matchCondition.owner_id = partnerId
    matchCondition.visibility = _.neq('private')
  } else {
    // 默认展示双方 (如果有伴侣) 或仅自己
    if (partnerId) {
      matchCondition = _.or([
        { owner_id: openId },
        { owner_id: partnerId, visibility: _.neq('private') }
      ])
    } else {
      matchCondition.owner_id = openId
    }
  }

  // 日期过滤
  if (dateFilter) {
    // dateFilter 格式预期为 'YYYY-MM-DD'
    const startOfDay = new Date(dateFilter + 'T00:00:00+08:00').getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1
    matchCondition.create_time = _.and(_.gte(startOfDay), _.lte(endOfDay))
  }

  const diariesRes = await db.collection('Diaries')
    .where(matchCondition)
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return { success: true, data: diariesRes.data }
}

async function handleGetTreeHole(openId, payload) {
  const { page = 1, pageSize = 10 } = payload || {}
  
  const diariesRes = await db.collection('Diaries')
    .where({ visibility: 'public' })
    .orderBy('create_time', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
    
  if (diariesRes.data.length === 0) {
    return { success: true, data: [] }
  }
  
  const ownerIds = [...new Set(diariesRes.data.map(d => d.owner_id))]
  const usersRes = await db.collection('Users').where({
    _id: _.in(ownerIds)
  }).get()
  
  const userMap = {}
  usersRes.data.forEach(u => {
    userMap[u._id] = {
      anonymous_name: u.anonymous_name || '某同学',
      color: generateColorFromId(u._id)
    }
  })
  
  const resultData = diariesRes.data.map(d => {
    const userInfo = userMap[d.owner_id] || { anonymous_name: '某同学', color: '#CCCCCC' }
    return {
      ...d,
      anonymous_name: userInfo.anonymous_name,
      avatar_color: userInfo.color,
      owner_id: undefined // 抹除真实ID
    }
  })
  
  return { success: true, data: resultData }
}

function generateColorFromId(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  let color = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF
    color += ('00' + value.toString(16)).substr(-2)
  }
  return color
}

async function handleToggleLike(openId, payload) {
  const { id } = payload
  if (!id) return { success: false, msg: '参数错误' }
  
  const likeQuery = { user_id: openId, diary_id: id }
  const existRes = await db.collection('Likes').where(likeQuery).get()
  
  let isLiked = false
  if (existRes.data.length > 0) {
    // 已赞，取消赞
    await db.collection('Likes').doc(existRes.data[0]._id).remove()
    await db.collection('Diaries').doc(id).update({
      data: { like_count: _.inc(-1) }
    })
  } else {
    // 未赞，点赞
    await db.collection('Likes').add({
      data: { user_id: openId, diary_id: id, timestamp: Date.now() }
    })
    await db.collection('Diaries').doc(id).update({
      data: { like_count: _.inc(1) }
    })
    isLiked = true
  }
  return { success: true, isLiked }
}

async function handleGetLikedDiaries(openId, payload) {
  const { page = 1, pageSize = 10 } = payload || {}
  
  const likesRes = await db.collection('Likes')
    .where({ user_id: openId })
    .orderBy('timestamp', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
    
  if (likesRes.data.length === 0) return { success: true, data: [] }
  
  const diaryIds = likesRes.data.map(l => l.diary_id)
  const diariesRes = await db.collection('Diaries').where({
    _id: _.in(diaryIds)
  }).get()
  
  // 保持按点赞时间排序
  const diaryMap = {}
  diariesRes.data.forEach(d => { diaryMap[d._id] = d })
  
  const sortedDiaries = diaryIds.map(id => diaryMap[id]).filter(Boolean)
  return { success: true, data: sortedDiaries }
}

async function handleGetOnThisDay(openId, payload) {
  const userRes = await db.collection('Users').doc(openId).get().catch(() => null)
  const partnerId = userRes ? userRes.data.partner_id : null
  
  let matchCondition = { owner_id: openId }
  if (partnerId) {
    matchCondition = _.or([
      { owner_id: openId },
      { owner_id: partnerId, visibility: _.neq('private') }
    ])
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const month = now.getMonth()
  const date = now.getDate()
  
  const ranges = []
  for (let i = 1; i <= 10; i++) {
    const start = new Date(currentYear - i, month, date, 0, 0, 0).getTime()
    const end = new Date(currentYear - i, month, date, 23, 59, 59, 999).getTime()
    ranges.push(_.and(_.gte(start), _.lte(end)))
  }

  const finalMatch = {
    ...matchCondition,
    create_time: _.or(ranges)
  }
  
  const diariesRes = await db.collection('Diaries')
    .where(finalMatch)
    .orderBy('create_time', 'desc')
    .get()
    
  return { success: true, data: diariesRes.data }
}
