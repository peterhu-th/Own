<template>
  <view class="container">
    <view class="header">
      <text class="export-toggle-btn" @click="toggleExportMode">{{ isExportMode ? '取消' : '导出' }}</text>
    </view>
    
    <view v-if="isExportMode" class="export-action-bar">
      <text>已选 {{ selectedExportIds.length }}/100</text>
      <button size="mini" type="primary" @click="confirmExport" :disabled="selectedExportIds.length === 0">导出为 TXT</button>
    </view>
    
    <view class="diary-list">
      <view class="diary-card" v-for="item in diaries" :key="item._id" @longpress="handleLongPress(item._id)" @click="isExportMode ? toggleSelect(item._id) : goToDetail(item._id)">
        <view class="checkbox-wrapper" v-if="isExportMode">
          <checkbox :checked="selectedExportIds.includes(item._id)" color="#FF7A59" />
        </view>
        <view class="author-info">
          <view class="avatar" :style="{ backgroundColor: item.avatar_color }">
            <text class="avatar-text">{{ item.anonymous_name.charAt(0) }}</text>
          </view>
          <view class="author-meta">
            <text class="nickname">{{ item.anonymous_name }}</text>
            <text class="time">{{ formatTime(item.create_time) }}</text>
          </view>
        </view>
        <view class="content">
          <text class="text-content" :class="{ 'truncate': true }">{{ item.content }}</text>
        </view>
        
        <view class="audio-player" v-if="item.audio_path" @click.stop="playAudio(item.audio_path)">
          <text class="play-icon">▶️</text> <text class="play-text">点击播放语音</text>
        </view>
        
        <view class="media-preview" v-if="item.media_list && item.media_list.length > 0">
          <image v-for="(img, idx) in item.media_list.slice(0, 3)" :key="idx" :src="img" mode="aspectFill" class="preview-img" />
          <view v-if="item.media_list.length > 3" class="more-media">+{{ item.media_list.length - 3 }}</view>
        </view>
        <view class="card-footer">
          <view class="like-btn" @click.stop="toggleLike(item)">
            <image :src="item.isLiked ? '/static/like-filled.svg' : '/static/like-empty.svg'" class="icon-svg" />
            <text>{{ item.like_count || 0 }}</text>
          </view>
          <view class="comment-btn">
            <image src="/static/comment.svg" class="icon-svg" />
            <text>{{ item.comment_count || 0 }}</text>
          </view>
        </view>
      </view>
    </view>
    <view class="loading-status" v-if="isLoading">加载中...</view>
    <view class="empty-status" v-if="!isLoading && diaries.length === 0">这里还是一片荒芜...</view>
    
    <view class="fab" @click="goToPublish">
      <text class="fab-text">+</text>
    </view>

    <view class="footer-overlay">
      <text class="footer-subtitle">先生，再给我讲讲坐满人的、演奏音乐的咖啡馆吧\n小姐，没有它们，我就活不下去\n——杜拉斯《广场》</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom, onUnload } from '@dcloudio/uni-app'
import { useExport } from '@/composables/useExport'

const diaries = ref([])
const isLoading = ref(false)
const cursor = ref(null)
const hasMore = ref(true)

const { isExportMode, selectedExportIds, toggleExportMode, handleLongPress, toggleSelect, confirmExport: executeExport } = useExport(diaries)

const innerAudioContext = uni.createInnerAudioContext()

onUnload(() => {
  if (innerAudioContext) {
    innerAudioContext.stop()
    innerAudioContext.destroy()
  }
})

const fetchDiaries = async (reset = false) => {
  if (isLoading.value || (!hasMore.value && !reset)) return
  isLoading.value = true
  if (reset) {
    cursor.value = null
    diaries.value = []
    hasMore.value = true
  }

  try {
    const res = await uni.cloud.callFunction({
      name: 'diaryCloud',
      data: { action: 'getSquare', payload: { cursor: cursor.value, pageSize: 10 } }
    })
    if (res.result.success) {
      const newData = res.result.data || []
      diaries.value.push(...newData)
      cursor.value = res.result.nextCursor || null
      if (!cursor.value || newData.length < 10) {
        hasMore.value = false
      }
    }
  } finally {
    isLoading.value = false
    uni.stopPullDownRefresh()
  }
}

const goToDetail = (id) => {
  uni.navigateTo({ url: `/pages/diary/detail?id=${id}` })
}

const playAudio = (path) => {
  if (innerAudioContext.src === path && !innerAudioContext.paused) {
    innerAudioContext.stop()
  } else {
    innerAudioContext.src = path
    innerAudioContext.play()
  }
}

const toggleLike = async (diary) => {
  try {
    const res = await uni.cloud.callFunction({ name: 'diaryCloud', data: { action: 'toggleLike', payload: { id: diary._id } } })
    if (res.result.success) {
      diary.like_count = diary.like_count || 0
      diary.like_count += res.result.isLiked ? 1 : -1
      diary.isLiked = res.result.isLiked
    }
  } catch (e) {
    console.error(e)
  }
}

const goToPublish = () => {
  uni.navigateTo({ url: '/pages/publish/publish?visibility=public' })
}

const confirmExport = () => {
  executeExport((d) => {
    const timeStr = formatTime(d.create_time)
    const authorStr = d.anonymous_name || '某同学'
    return `【${timeStr}】(${authorStr}) \n${d.content}`
  })
}

const formatTime = (ts) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onShow(() => {
  fetchDiaries(true)
})

onPullDownRefresh(() => {
  fetchDiaries(true)
})

onReachBottom(() => {
  fetchDiaries()
})
</script>

<style scoped>
.container {
  padding: 30rpx;
  padding-bottom: 250rpx;
  background-color: #FFF8F0;
  min-height: 100vh;
  box-sizing: border-box;
}
.header {
  margin-bottom: 20rpx;
  padding: 10rpx 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
.export-toggle-btn {
  font-size: 26rpx;
  color: #007aff;
}
.export-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 20rpx 30rpx;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.05);
}
.fab {
  position: fixed;
  bottom: 60rpx;
  right: 40rpx;
  width: 100rpx;
  height: 100rpx;
  background-color: #FF7A59;
  color: #fff;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.4);
  z-index: 100;
}
.fab-text {
  color: #fff;
  font-size: 60rpx;
  font-weight: bold;
  line-height: 100rpx;
}
.checkbox-wrapper {
  margin-bottom: 20rpx;
}
.card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 30rpx;
  margin-top: 20rpx;
  border-top: 1px solid #f0f0f0;
  padding-top: 20rpx;
}
.like-btn, .comment-btn {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #888;
  line-height: 1;
}
.icon-svg {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
  transform: translateY(1rpx);
}
.footer-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 250rpx;
  pointer-events: none;
  z-index: 10;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: linear-gradient(to bottom, rgba(255, 248, 240, 0) 0%, rgba(255, 248, 240, 0.9) 60%, rgba(255, 248, 240, 1) 100%);
  padding-bottom: 40rpx;
}
.footer-subtitle {
  text-align: center;
  font-size: 24rpx;
  color: #a9a9a9;
  line-height: 1.8;
  font-style: italic;
  letter-spacing: 2rpx;
}
.title {
  font-size: 50rpx;
  font-weight: bold;
  color: #333;
  display: block;
}
.subtitle {
  font-size: 28rpx;
  color: #999;
  margin-top: 10rpx;
  display: block;
}
.diary-list {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}
.diary-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
}
.author-info {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}
.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}
.avatar-text {
  color: #fff;
  font-size: 36rpx;
  font-weight: bold;
}
.author-meta {
  display: flex;
  flex-direction: column;
}
.nickname {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}
.time {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}
.content {
  margin-bottom: 20rpx;
}
.text-content {
  font-size: 30rpx;
  color: #444;
  line-height: 1.6;
}
.truncate {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  overflow: hidden;
}
.audio-player {
  display: inline-flex;
  align-items: center;
  background: #f5f5f5;
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
  margin-top: 10rpx;
  margin-bottom: 20rpx;
  gap: 10rpx;
}
.play-icon { font-size: 24rpx; }
.play-text { font-size: 26rpx; color: #666; }
.media-preview {
  display: flex;
  gap: 10rpx;
  margin-top: 20rpx;
  position: relative;
}
.preview-img {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
}
.more-media {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: rgba(0,0,0,0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  position: absolute;
  right: 0;
}
.loading-status, .empty-status {
  text-align: center;
  color: #999;
  padding: 40rpx;
  font-size: 28rpx;
}
</style>
