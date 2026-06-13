const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openId = wxContext.OPENID
  const { action, payload } = event

  if (action === 'addComment') {
    const { diary_id, content } = payload
    if (!content || !content.trim()) return { success: false, msg: '批注不能为空' }

    // Insert comment
    const res = await db.collection('Comments').add({
      data: {
        diary_id,
        commenter_id: openId,
        content,
        create_time: Date.now()
      }
    })

    // Log Activity
    await db.collection('ActivityLog').add({
      data: {
        user_id: openId,
        type: 'comment',
        action: '添加了批注',
        target_id: diary_id,
        timestamp: Date.now()
      }
    })

    return { success: true, commentId: res._id }
  } else if (action === 'deleteComment') {
    const { id } = payload
    if (!id) return { success: false, msg: '参数错误' }

    const record = await db.collection('Comments').doc(id).get().catch(() => null)
    if (!record || record.data.commenter_id !== openId) {
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
