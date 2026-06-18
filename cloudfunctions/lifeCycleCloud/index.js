const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 测试时可关闭解绑冷静期
const ENABLE_COOLDOWN = true

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { action } = event

  switch (action) {
    case 'requestUnbind':
      return await handleRequestUnbind(openId)
    case 'cancelUnbind':
      return await handleCancelUnbind(openId)
    case 'confirmUnbind':
      return await handleConfirmUnbind(openId)
    case 'exportData':
      return await handleExportData(openId)
    default:
      return { success: false, msg: 'Unknown action' }
  }
}

async function handleRequestUnbind(openId) {
  const userRecord = await db.collection('Users').doc(openId).get().catch(() => null)
  if (!userRecord || !userRecord.data.partner_id) return { success: false, msg: '不可解绑' }

  await db.collection('Users').doc(openId).update({
    data: {
      unbind_initiator: openId,
      unbind_request_time: Date.now()
    }
  })
  return { success: true }
}

async function handleCancelUnbind(openId) {
  await db.collection('Users').doc(openId).update({
    data: { unbind_initiator: null, unbind_request_time: null }
  })
  return { success: true }
}

async function handleConfirmUnbind(openId) {
  const userRecord = await db.collection('Users').doc(openId).get().catch(() => null)
  if (!userRecord || !userRecord.data.partner_id) return { success: false, msg: '关系异常' }

  const partnerId = userRecord.data.partner_id
  const requestTime = userRecord.data.unbind_request_time

  if (ENABLE_COOLDOWN && requestTime) {
    const elapsed = Date.now() - requestTime
    if (elapsed < 72 * 60 * 60 * 1000) {
      return { success: false, msg: '还在冷静期内' }
    }
  }

  // 1. 清除两人 Users 记录中的 partner_id 及 unbind 记录
  await db.collection('Users').doc(openId).update({
    data: { partner_id: null, unbind_initiator: null, unbind_request_time: null }
  })
  await db.collection('Users').doc(partnerId).update({
    data: { partner_id: null, unbind_initiator: null, unbind_request_time: null }
  })

  // 2. 删除互留的批注 (A 评论 B的日记，或者 B 评论 A 的日记，不包含自己评论自己)
  // 找出对方的日记ID
  const partnerDiariesRes = await db.collection('Diaries').where({ owner_id: partnerId }).get()
  const partnerDiaryIds = partnerDiariesRes.data.map(d => d._id)
  
  if (partnerDiaryIds.length > 0) {
    // 删除我写给对方的批注
    await db.collection('Comments').where({
      commenter_id: openId,
      diary_id: _.in(partnerDiaryIds)
    }).remove()
  }

  const myDiariesRes = await db.collection('Diaries').where({ owner_id: openId }).get()
  const myDiaryIds = myDiariesRes.data.map(d => d._id)
  if (myDiaryIds.length > 0) {
    // 删除对方写给我的批注
    await db.collection('Comments').where({
      commenter_id: partnerId,
      diary_id: _.in(myDiaryIds)
    }).remove()
  }

  return { success: true }
}

async function handleExportData(openId) {
  // 生成导出逻辑，暂返回临时成功标识
  // 实际需查询所有 Diaries 和 Comments 并拼接 Markdown，用 cloud.uploadFile 上传
  return { success: true, fileUrl: 'https://example.com/exported_data.md' }
}
