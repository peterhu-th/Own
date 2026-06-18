<template>
  <view class="container" v-if="diary">
    <view class="diary-content" :class="{ 'my-diary': diary.owner_id === userStore.openId, 'partner-diary': diary.owner_id !== userStore.openId }">
      <view class="header">
        <view class="author-info">
          <text class="time">{{ formatTime(diary.create_time) }}</text>
          <text class="anonymous-name" v-if="diary.anonymous_name">{{ diary.anonymous_name }}</text>
        </view>
        <view class="action-btns">
          <text class="like-btn" @click="toggleLike">{{ isLiked ? '❤️' : '🤍' }} {{ diary.like_count || 0 }}</text>
          <text class="edit-btn" v-if="diary.owner_id === userStore.openId" @click="editDiary">修改</text>
          <text class="delete-btn" v-if="diary.owner_id === userStore.openId" @click="deleteDiary">删除</text>
        </view>
      </view>
      <text class="text" user-select>{{ diary.content }}</text>
      
      <view class="audio-player" v-if="diary.audio_path" @click="playAudio(diary.audio_path)">
        <text class="play-icon">▶️</text> <text class="play-text">点击播放语音</text>
      </view>
      
      <view class="media-list" v-if="diary.media_list && diary.media_list.length > 0">
        <image 
          v-for="(img, idx) in diary.media_list" 
          :key="idx" 
          :src="img" 
          mode="widthFix" 
          class="detail-img"
          @click="previewImage(img, diary.media_list)"
        />
      </view>
    </view>
    
    <view class="comment-section">
      <text class="comment-title">批注</text>
      <view class="comment-list">
        <view class="comment-item" :class="{ 'my-comment': comment.commenter_id === userStore.openId, 'partner-comment': comment.commenter_id !== userStore.openId }" v-for="(comment, index) in comments" :key="index" @click="prepareReply(comment)">
          <view class="comment-header">
            <view class="comment-info">
              <text class="comment-time">{{ formatTime(comment.create_time) }}</text>
            </view>
            <text v-if="comment.commenter_id === userStore.openId" class="delete-btn" @click.stop="deleteComment(comment._id)">删除</text>
          </view>
          <text class="comment-text" user-select>
            <text class="reply-to" v-if="comment.reply_to_user">回复 @{{ comment.reply_to_user }}: </text>
            {{ comment.content }}
          </text>
        </view>
        <view v-if="comments.length === 0" class="empty-comment">暂无批注</view>
      </view>
      
      <view class="reply-hint" v-if="replyToId" @click="clearReply">
        <text>回复 @{{ replyToUser }} (点击取消)</text>
      </view>
      <view class="comment-input-box">
        <input class="input" :placeholder="replyToId ? '回复 @' + replyToUser : '写下你的留言...'" v-model="newComment" confirm-type="send" @confirm="addComment" />
        <button size="mini" type="primary" :loading="isSubmitting" @click="addComment">发送</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { formatWeChatTime } from '@/utils/time'

const userStore = useUserStore()
const diaryId = ref('')
const diary = ref(null)
const comments = ref([])
const newComment = ref('')
const isSubmitting = ref(false)
const isLiked = ref(false)
const replyToId = ref(null)
const replyToUser = ref(null)
const isLiking = ref(false)

const innerAudioContext = uni.createInnerAudioContext()

onUnload(() => {
  if (innerAudioContext) {
    innerAudioContext.stop()
    innerAudioContext.destroy()
  }
})

onLoad((options) => {
  if (options.id) {
    diaryId.value = options.id
    if (!userStore.myNickname) {
      userStore.fetchProfile()
    }
    fetchDetailData()
  }
})

const fetchDetailData = async () => {
  try {
    uni.showLoading({ title: '加载中' })
    const res = await uni.cloud.callFunction({
      name: 'diaryCloud',
      data: {
        action: 'getDetail',
        payload: { id: diaryId.value }
      }
    })
    
    if (res.result.success) {
      diary.value = res.result.diary
      comments.value = res.result.comments
      isLiked.value = res.result.isLiked
    } else {
      uni.showToast({ title: res.result.msg || '拉取详情失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '拉取详情失败', icon: 'none' })
    console.error('拉取详情失败', e)
  } finally {
    uni.hideLoading()
  }
}

const formatTime = (ts) => formatWeChatTime(ts)

const previewImage = (current, urls) => {
  uni.previewImage({ current, urls, showmenu: true })
}

const playAudio = (path) => {
  if (innerAudioContext.src === path && !innerAudioContext.paused) {
    innerAudioContext.stop()
  } else {
    innerAudioContext.src = path
    innerAudioContext.play()
  }
}

const editDiary = () => {
  // Pass the id to publish.vue
  uni.navigateTo({ url: `/pages/publish/publish?editId=${diaryId.value}` })
}

const deleteDiary = () => {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，且会同步删除该日记下的所有批注，是否继续？',
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '删除中' })
        try {
          const result = await uni.cloud.callFunction({
            name: 'diaryCloud',
            data: { action: 'delete', payload: { id: diaryId.value } }
          })
          if (result.result.success) {
            uni.showToast({ title: '删除成功' })
            setTimeout(() => {
              uni.$emit('refreshDiaries')
              uni.navigateBack()
            }, 1000)
          } else {
            uni.showToast({ title: result.result.msg || '删除失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '操作异常', icon: 'none' })
        } finally {
          uni.hideLoading()
        }
      }
    }
  })
}

const toggleLike = async () => {
  if (isLiking.value) return
  isLiking.value = true
  try {
    const res = await uni.cloud.callFunction({ name: 'diaryCloud', data: { action: 'toggleLike', payload: { id: diaryId.value } } })
    if (res.result.success) {
      isLiked.value = res.result.isLiked
      diary.value.like_count = diary.value.like_count || 0
      diary.value.like_count += isLiked.value ? 1 : -1
      uni.$emit('refreshDiaries')
    }
  } catch (e) {
    console.error(e)
  } finally {
    setTimeout(() => { isLiking.value = false }, 1000)
  }
}

const prepareReply = (comment) => {
  replyToId.value = comment._id
  let authorName = '某同学'
  if (comment.commenter_id === userStore.openId) authorName = userStore.myNickname || '我'
  else if (comment.commenter_id === userStore.partnerId) authorName = userStore.partnerNickname || '你'
  replyToUser.value = authorName
}

const clearReply = () => {
  replyToId.value = null
  replyToUser.value = null
}

const addComment = async () => {
  if (!newComment.value.trim() || isSubmitting.value) return
  isSubmitting.value = true
  
  try {
    const res = await uni.cloud.callFunction({
      name: 'commentCloud',
      data: {
        action: 'addComment',
        payload: {
          diary_id: diaryId.value,
          content: newComment.value,
          reply_to_id: replyToId.value,
          reply_to_user: replyToUser.value
        }
      }
    })
    
    if (res.result.success) {
      uni.showToast({ title: '留言成功', icon: 'none' })
      newComment.value = ''
      clearReply()
      fetchDetailData() // Refresh comments
    } else {
      uni.showToast({ title: res.result.msg || '留言失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    setTimeout(() => { isSubmitting.value = false }, 1000)
  }
}

const deleteComment = (commentId) => {
  uni.showModal({
    title: '确认删除',
    content: '确认删除这条批注吗？',
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '删除中' })
        try {
          const result = await uni.cloud.callFunction({
            name: 'commentCloud',
            data: { action: 'deleteComment', payload: { id: commentId } }
          })
          if (result.result.success) {
            uni.showToast({ title: '删除成功' })
            fetchDetailData() // Refresh comments
          } else {
            uni.showToast({ title: result.result.msg || '删除失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '操作异常', icon: 'none' })
        } finally {
          uni.hideLoading()
        }
      }
    }
  })
}
</script>

<style scoped>
.container {
  padding: 30rpx;
  background-color: #FFF8F0;
  min-height: 100vh;
}
.diary-content {
  padding: 40rpx 30rpx;
  border-radius: 20rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.08);
}
.my-diary {
  background: #FFFFFF;
}
.partner-diary {
  background: #FFF5F5;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.author-info {
  display: flex;
  align-items: center;
}
.time {
  font-size: 24rpx;
  color: #999;
}
.action-btns {
  display: flex;
  gap: 20rpx;
  align-items: center;
}
.like-btn, .edit-btn, .delete-btn {
  font-size: 26rpx;
  padding: 10rpx;
}
.like-btn { color: #FF7A59; font-weight: bold; }
.edit-btn { color: #007aff; }
.delete-btn { color: #e64340; }
.anonymous-name {
  font-size: 24rpx;
  color: #FF7A59;
  margin-left: 10rpx;
  background: rgba(255, 122, 89, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.text {
  font-size: 32rpx;
  line-height: 1.6;
  color: #333;
}
.audio-player {
  display: inline-flex;
  align-items: center;
  background: #f5f5f5;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  margin-top: 20rpx;
  gap: 10rpx;
}
.play-icon { font-size: 24rpx; }
.play-text { font-size: 26rpx; color: #666; }
.media-list {
  margin-top: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.detail-img {
  width: 100%;
  border-radius: 12rpx;
}
.comment-section {
  background: transparent;
}
.comment-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}
.comment-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.comment-item {
  padding: 24rpx;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2rpx 10rpx rgba(255, 122, 89, 0.05);
}
.my-comment {
  background: #fff;
  align-self: flex-end;
  border-bottom-right-radius: 4rpx;
  max-width: 85%;
}
.partner-comment {
  background: #FFF5F5;
  align-self: flex-start;
  border-bottom-left-radius: 4rpx;
  max-width: 85%;
}
.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.comment-info {
  display: flex;
  align-items: center;
}
.comment-time {
  font-size: 22rpx;
  color: #999;
}
.comment-text {
  font-size: 28rpx;
  color: #555;
  line-height: 1.5;
}
.empty-comment {
  text-align: center;
  color: #999;
  font-size: 26rpx;
  padding: 30rpx 0;
}
.comment-input-box {
  display: flex;
  margin-top: 10rpx;
  gap: 16rpx;
  align-items: center;
}
.reply-hint {
  font-size: 24rpx;
  color: #FF7A59;
  margin-top: 20rpx;
  padding: 10rpx;
}
.reply-to {
  color: #007aff;
  font-weight: bold;
}
.input {
  flex: 1;
  background: #fff;
  height: 72rpx;
  border-radius: 36rpx;
  padding: 0 30rpx;
  font-size: 28rpx;
}
</style>
