const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { action, payload } = event

  switch (action) {
    case 'getProfile':
      return await handleGetProfile(openId)
    case 'updateProfile':
      return await handleUpdateProfile(openId, payload)
    case 'getActivityLogs':
      return await handleGetActivityLogs(openId)
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function handleUpdateProfile(openId, payload) {
  const { nickname, avatarUrl } = payload
  let data = {}
  if (nickname !== undefined) data.nickname = nickname
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl
  
  if (Object.keys(data).length > 0) {
    try {
      await db.collection('Users').doc(openId).update({ data })
      return { success: true }
    } catch(e) {
      return { success: false, msg: '更新失败' }
    }
  }
  return { success: true }
}

async function handleGetProfile(openId) {
  const usersCollection = db.collection('Users')
  const myRecord = await usersCollection.doc(openId).get().catch(() => null)
  if (!myRecord) return { success: false }
  
  let partnerData = null
  if (myRecord.data.partner_id) {
    const partnerRecord = await usersCollection.doc(myRecord.data.partner_id).get().catch(() => null)
    if (partnerRecord) {
      const isOnline = Date.now() - partnerRecord.data.last_active_time < 60000
      partnerData = {
        is_online: isOnline,
        last_active_time: partnerRecord.data.last_active_time,
        total_online_minutes: partnerRecord.data.total_online_minutes,
        nickname: partnerRecord.data.nickname || partnerRecord.data._id.substring(0, 8) + '...',
        avatarUrl: partnerRecord.data.avatarUrl || ''
      }
    }
  }

  return { 
    success: true, 
    myData: {
      total_online_minutes: myRecord.data.total_online_minutes,
      partner_id: myRecord.data.partner_id,
      unbind_request_time: myRecord.data.unbind_request_time,
      unbind_initiator: myRecord.data.unbind_initiator,
      nickname: myRecord.data.nickname || myRecord.data._id.substring(0, 8) + '...',
      avatarUrl: myRecord.data.avatarUrl || ''
    },
    partnerData 
  }
}

async function handleGetActivityLogs(openId) {
  const usersCollection = db.collection('Users')
  const myRecord = await usersCollection.doc(openId).get().catch(() => null)
  const partnerId = myRecord ? myRecord.data.partner_id : null
  
  let matchCondition = { user_id: openId }
  // 绑定状态或解绑冷静期可以看见对方，既然关系还在 partner_id 就不为空
  if (partnerId) {
    matchCondition.user_id = _.in([openId, partnerId])
  }

  const logsRes = await db.collection('ActivityLog')
    .where(matchCondition)
    .orderBy('timestamp', 'desc')
    .limit(30)
    .get()

  return { success: true, data: logsRes.data }
}
