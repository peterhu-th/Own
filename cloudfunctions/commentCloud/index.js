const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { action, payload } = event

  if (action === 'addComment') {
    const { diary_id, content, reply_to_id, reply_to_user } = payload
    if (!content || !content.trim()) return { success: false, msg: '留言不能为空' }

    // 校验对日记的访问权限
    const diaryRes = await db.collection('Diaries').doc(diary_id).get().catch(() => null)
    if (!diaryRes || !diaryRes.data) {
      return { success: false, msg: '日记不存在' }
    }
    const diaryData = diaryRes.data

    let canAccess = false
    if (diaryData.owner_id === openId) {
      canAccess = true
    } else if (diaryData.visibility === 'public') {
      canAccess = true
    } else {
      const userRes = await db.collection('Users').doc(openId).get().catch(() => null)
      if (userRes && userRes.data && userRes.data.partner_id === diaryData.owner_id && diaryData.visibility !== 'private') {
        canAccess = true
      }
    }

    if (!canAccess) {
      return { success: false, msg: '无权在该日记留言' }
    }

    // Insert comment
    const res = await db.collection('Comments').add({
      data: {
        diary_id,
        commenter_id: openId,
        content,
        reply_to_id: reply_to_id || null,
        reply_to_user: reply_to_user || null,
        create_time: Date.now()
      }
    })

    // Log Activity
    await db.collection('ActivityLog').add({
      data: {
        user_id: openId,
        type: 'comment',
        action: '添加了留言',
        target_id: diary_id,
        timestamp: Date.now()
      }
    })

    return { success: true, commentId: res._id }
  } else if (action === 'deleteComment') {
    const { id } = payload
    if (!id) return { success: false, msg: '参数错误' }

    const record = await db.collection('Comments').doc(id).get().catch(() => null)
    if (!record) return { success: false, msg: '记录不存在' }

    let canDelete = record.data.commenter_id === openId
    if (!canDelete) {
      const diaryRes = await db.collection('Diaries').doc(record.data.diary_id).get().catch(() => null)
      if (diaryRes && diaryRes.data.owner_id === openId) {
        canDelete = true
      }
    }

    if (!canDelete) {
      return { success: false, msg: '无权删除' }
    }

    try {
      await db.collection('Comments').doc(id).remove()
      return { success: true }
    } catch (e) {
      return { success: false, msg: '删除失败' }
    }
  }

  return { success: false }
}
