// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 全局配置测试冷静期，正式可改为 true
const ENABLE_COOLDOWN = true;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID

  const { action, payload } = event

  switch (action) {
    case 'login':
      return await handleLogin(openId)
    case 'bindPartner':
      return await handleBindPartner(openId, payload.inviteCode)
    case 'heartbeat':
      return await handleHeartbeat(openId, payload.sessionMinutes)
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function handleLogin(openId) {
  const usersCollection = db.collection('Users')
  let userRecord = await usersCollection.doc(openId).get().catch(() => null)

  if (!userRecord) {
    // 首次注册
    await usersCollection.add({
      data: {
        _id: openId,
        partner_id: null,
        invite_code: generateInviteCode(),
        invite_expire: Date.now() + 15 * 60 * 1000,
        is_online: true,
        last_active_time: Date.now(),
        total_online_minutes: 0,
        lock_until: 0,
        fail_count: 0,
        unbind_initiator: null,
        unbind_request_time: null
      }
    })
    userRecord = { data: { partner_id: null, invite_code: generateInviteCode() } }
    
    // 记录注册活动
    await logActivity(openId, 'diary', '注册了日记本', null)
  } else {
    // 更新心跳和在线状态
    await usersCollection.doc(openId).update({
      data: {
        is_online: true,
        last_active_time: Date.now()
      }
    })
    
    // 如果没有邀请码或者已过期，重新生成
    if (!userRecord.data.partner_id && (!userRecord.data.invite_code || Date.now() > userRecord.data.invite_expire)) {
      const newCode = generateInviteCode()
      await usersCollection.doc(openId).update({
        data: {
          invite_code: newCode,
          invite_expire: Date.now() + 15 * 60 * 1000
        }
      })
      userRecord.data.invite_code = newCode
    }
  }

  let pNick = ''
  if (userRecord.data.partner_id) {
    const pRec = await usersCollection.doc(userRecord.data.partner_id).get().catch(() => null)
    if (pRec) pNick = pRec.data.nickname || pRec.data._id.substring(0, 8) + '...'
  }
  const myNick = userRecord.data.nickname || userRecord.data._id.substring(0, 8) + '...'

  return { 
    success: true, 
    openId, 
    partnerId: userRecord.data.partner_id, 
    inviteCode: userRecord.data.invite_code,
    myNickname: myNick,
    partnerNickname: pNick
  }
}

async function handleBindPartner(openId, inviteCode) {
  if (!inviteCode || inviteCode.length !== 6) return { success: false, msg: '邀请码格式错误' }

  const usersCollection = db.collection('Users')
  const myRecord = await usersCollection.doc(openId).get().catch(() => null)
  
  if (!myRecord) return { success: false, msg: '请先登录' }
  
  if (myRecord.data.lock_until && Date.now() < myRecord.data.lock_until) {
    const remainingSeconds = Math.ceil((myRecord.data.lock_until - Date.now()) / 1000)
    return { success: false, msg: `输入错误次数过多，请 ${remainingSeconds} 秒后再试` }
  }

  if (myRecord.data.invite_code === inviteCode) {
    return { success: false, msg: '不能与自己绑定' }
  }

  // 查找邀请码
  const targetUserRes = await usersCollection.where({
    invite_code: inviteCode
  }).get()

  if (targetUserRes.data.length === 0 || targetUserRes.data[0]._id === openId) {
    // 失败记录
    const newFailCount = (myRecord.data.fail_count || 0) + 1
    const updateData = { fail_count: newFailCount }
    if (newFailCount >= 3) {
      updateData.lock_until = Date.now() + 60 * 1000 // 锁定1分钟
      updateData.fail_count = 0
    }
    await usersCollection.doc(openId).update({ data: updateData })
    return { success: false, msg: updateData.lock_until ? '错误3次，已锁定1分钟' : '邀请码无效或已过期' }
  }

  const targetUser = targetUserRes.data[0]
  if (Date.now() > targetUser.invite_expire) {
    return { success: false, msg: '邀请码已过期' }
  }

  // 绑定成功，互相写入 partner_id
  await usersCollection.doc(openId).update({
    data: { partner_id: targetUser._id, fail_count: 0, lock_until: 0, invite_code: null }
  })
  await usersCollection.doc(targetUser._id).update({
    data: { partner_id: openId, invite_code: null }
  })

  await logActivity(openId, 'diary', '与你绑定了关系', null)
  await logActivity(targetUser._id, 'diary', '与你绑定了关系', null)

  return { success: true, partnerId: targetUser._id }
}

async function handleHeartbeat(openId, sessionMinutes = 0) {
  const usersCollection = db.collection('Users')
  
  const updateData = {
    last_active_time: Date.now(),
    is_online: true
  }
  
  if (sessionMinutes > 0) {
    updateData.total_online_minutes = _.inc(sessionMinutes)
  }
  
  await usersCollection.doc(openId).update({
    data: updateData
  })

  return { success: true }
}

function generateInviteCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function logActivity(userId, type, actionText, targetId) {
  await db.collection('ActivityLog').add({
    data: {
      user_id: userId,
      type: type, // 'diary', 'comment'
      action: actionText,
      target_id: targetId,
      timestamp: Date.now()
    }
  })
}
