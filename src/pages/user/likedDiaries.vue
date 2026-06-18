<template>
  <view class="container">
    <view class="diary-list">
      <view class="diary-card" v-for="diary in diaries" :key="diary._id" @click="goToDetail(diary._id)">
        <view class="card-header">
          <text class="time">{{ formatTime(diary.create_time) }}</text>
        </view>
        <view class="card-content">
          <text class="text-content clamp-text">{{ diary.content }}</text>
        </view>
      </view>
      <view v-if="diaries.length === 0 && !isLoading" class="empty">暂无赞过的日记</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'

const diaries = ref([])
const cursor = ref(null)
const hasMore = ref(true)
const isLoading = ref(false)

const fetchLikedDiaries = async (reset = false) => {
  if (isLoading.value || (!hasMore.value && !reset)) return
  isLoading.value = true
  if (reset) {
    cursor.value = null
    hasMore.value = true
    diaries.value = []
  }

  try {
    const res = await uni.cloud.callFunction({
      name: 'diaryCloud',
      data: { action: 'getLikedDiaries', payload: { cursor: cursor.value, pageSize: 10 } }
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

const formatTime = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onShow(() => {
  fetchLikedDiaries(true)
})

onPullDownRefresh(() => {
  fetchLikedDiaries(true)
})

onReachBottom(() => {
  fetchLikedDiaries()
})
</script>

<style scoped>
.container {
  padding: 30rpx;
  background-color: #FFF8F0;
  min-height: 100vh;
}
.diary-list {
  display: flex;
  flex-direction: column;
}
.diary-card {
  background: #fff;
  padding: 30rpx;
  border-radius: 20rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.08);
}
.card-header {
  margin-bottom: 20rpx;
}
.time {
  font-size: 24rpx;
  color: #999;
}
.text-content {
  font-size: 30rpx;
  color: #333;
  line-height: 1.5;
}
.clamp-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
.empty {
  text-align: center;
  color: #999;
  margin-top: 100rpx;
}
</style>
