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
    const diaryRes = await db.collection('Diaries').doc(id).get()
    const commentsRes = await db.collection('Comments')
      .where({ diary_id: id })
      .orderBy('create_time', 'asc')
      .get()

    return { 
      success: true, 
      diary: diaryRes.data,
      comments: commentsRes.data 
    }
  } catch (e) {
    return { success: false, msg: '拉取详情失败' }
  }
}

async function handlePublish(openId, payload) {
  const { content, media_list = [], is_backdated = false, custom_time } = payload
  if (!content || !content.trim()) {
    return { success: false, msg: '内容不能为空' }
  }
  
  const createTime = is_backdated && custom_time ? custom_time : Date.now()

  const res = await db.collection('Diaries').add({
    data: {
      owner_id: openId,
      content,
      media_list,
      is_backdated,
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
  } else {
    // 默认展示双方 (如果有伴侣) 或仅自己
    if (partnerId) {
      matchCondition.owner_id = _.in([openId, partnerId])
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
