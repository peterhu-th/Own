<template>
  <view class="container" v-if="diary">
    <view class="diary-content" :class="{ 'my-diary': diary.owner_id === userStore.openId, 'partner-diary': diary.owner_id !== userStore.openId }">
      <view class="header">
        <view class="author-info">
          <text class="time">{{ formatTime(diary.create_time) }}</text>
        </view>
        <view class="action-btns" v-if="diary.owner_id === userStore.openId">
          <text class="edit-btn" @click="editDiary">修改</text>
          <text class="delete-btn" @click="deleteDiary">删除</text>
        </view>
      </view>
      <text class="text" user-select>{{ diary.content }}</text>
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
        <view class="comment-item" :class="{ 'my-comment': comment.commenter_id === userStore.openId, 'partner-comment': comment.commenter_id !== userStore.openId }" v-for="(comment, index) in comments" :key="index">
          <view class="comment-header">
            <view class="comment-info">
              <text class="comment-time">{{ formatTime(comment.create_time) }}</text>
            </view>
            <text v-if="comment.commenter_id === userStore.openId" class="delete-btn" @click="deleteComment(comment._id)">删除</text>
          </view>
          <text class="comment-text" user-select>{{ comment.content }}</text>
        </view>
        <view v-if="comments.length === 0" class="empty-comment">暂无批注</view>
      </view>
      
      <view class="comment-input-box">
        <input class="input" placeholder="写下你的批注..." v-model="newComment" confirm-type="send" @confirm="addComment" />
        <button size="mini" type="primary" :loading="isSubmitting" @click="addComment">发送</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { formatWeChatTime } from '@/utils/time'

const userStore = useUserStore()
const diaryId = ref('')
const diary = ref(null)
const comments = ref([])
const newComment = ref('')
const isSubmitting = ref(false)

onLoad((options) => {
  if (options.id) {
    diaryId.value = options.id
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
          content: newComment.value
        }
      }
    })
    
    if (res.result.success) {
      uni.showToast({ title: '批注成功', icon: 'none' })
      newComment.value = ''
      fetchDetailData() // Refresh comments
    } else {
      uni.showToast({ title: res.result.msg || '批注失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    isSubmitting.value = false
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
}
.edit-btn, .delete-btn {
  font-size: 26rpx;
  padding: 10rpx;
}
.edit-btn { color: #007aff; }
.delete-btn { color: #e64340; }
.text {
  font-size: 32rpx;
  line-height: 1.6;
  color: #333;
}
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
  margin-top: 30rpx;
  gap: 16rpx;
  align-items: center;
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
