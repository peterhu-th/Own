<template>
  <view class="container">
    <view class="header">
      <text class="title">匿名树洞</text>
      <text class="subtitle">倾听彼此的声音</text>
    </view>
    <view class="diary-list">
      <view class="diary-card" v-for="item in diaries" :key="item._id" @click="goToDetail(item._id)">
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
      </view>
    </view>
    <view class="loading-status" v-if="isLoading">加载中...</view>
    <view class="empty-status" v-if="!isLoading && diaries.length === 0">这里还是一片荒芜...</view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'

const diaries = ref([])
const isLoading = ref(false)
const page = ref(1)
const hasMore = ref(true)

const innerAudioContext = uni.createInnerAudioContext()

const fetchDiaries = async (reset = false) => {
  if (isLoading.value || (!hasMore.value && !reset)) return
  isLoading.value = true
  if (reset) {
    page.value = 1
    diaries.value = []
    hasMore.value = true
  }

  try {
    const res = await uni.cloud.callFunction({
      name: 'diaryCloud',
      data: { action: 'getTreeHole', payload: { page: page.value, pageSize: 10 } }
    })
    if (res.result.success) {
      if (res.result.data.length < 10) {
        hasMore.value = false
      }
      diaries.value.push(...res.result.data)
      page.value++
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
  background-color: #FFF8F0;
  min-height: 100vh;
}
.header {
  margin-bottom: 40rpx;
  padding: 20rpx 0;
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
  -webkit-line-clamp: 3;
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
