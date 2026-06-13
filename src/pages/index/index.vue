<template>
  <view class="container">
    <view class="filter-bar">
      <picker mode="date" @change="onDateChange" :end="todayStr">
        <view class="picker-box">
          <text class="picker-text">{{ selectedDate || '所有日期' }}</text>
          <text class="arrow">▼</text>
        </view>
      </picker>
      
      <picker mode="selector" :range="ownerLabels" @change="onOwnerChange">
        <view class="picker-box">
          <text class="picker-text">{{ ownerLabels[selectedOwnerIdx] }}</text>
          <text class="arrow">▼</text>
        </view>
      </picker>
      
      <text class="clear-btn" v-if="selectedDate || selectedOwnerIdx !== 0" @click="clearFilter">清除</text>
    </view>

    <view class="diary-list">
      <view 
        class="diary-card" 
        :class="{ 'my-diary': diary.owner_id === userStore.openId, 'partner-diary': diary.owner_id !== userStore.openId }"
        v-for="(diary, index) in diaries" 
        :key="index"
        @click="goToDetail(diary._id)"
      >
        <view class="card-header">
          <text class="time">{{ formatTime(diary.create_time) }}</text>
          <text v-if="diary.is_backdated" class="badge">补传</text>
        </view>
        <view class="card-content">
          <text class="text-content clamp-text"><text class="author">{{ getAuthorPrefix(diary.owner_id) }}</text>{{ diary.content }}</text>
          <view class="media-grid" v-if="diary.media_list && diary.media_list.length > 0">
            <view 
              v-for="(img, imgIdx) in diary.media_list.slice(0, 3)" 
              :key="imgIdx" 
              class="grid-img-wrapper"
              @click.stop="previewImage(img, diary.media_list)"
            >
              <image 
                :src="img" 
                mode="aspectFill" 
                class="grid-img"
              />
              <view v-if="imgIdx === 2 && diary.media_list.length > 3" class="more-badge">
                +{{ diary.media_list.length - 3 }}
              </view>
            </view>
          </view>
        </view>
      </view>
      <view v-if="diaries.length === 0" class="empty">暂无日记</view>
    </view>
    
    <view class="fab" @click="goToPublish">
      <text class="fab-text">+</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh, onLoad, onReachBottom } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { formatWeChatTime } from '@/utils/time'

const userStore = useUserStore()
const diaries = ref([])
const selectedDate = ref('')
const ownerLabels = ['所有人', '我', '你']
const ownerValues = ['all', 'me', 'partner']
const selectedOwnerIdx = ref(0)
const todayStr = ref('')

const currentPage = ref(1)
const pageSize = 10
const hasMore = ref(true)
const isLoading = ref(false)

onLoad(() => {
  const d = new Date()
  todayStr.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  uni.$on('refreshDiaries', refreshList)
})

const onDateChange = (e) => {
  selectedDate.value = e.detail.value
  refreshList()
}
const onOwnerChange = (e) => {
  selectedOwnerIdx.value = e.detail.value
  refreshList()
}
const clearFilter = () => {
  selectedDate.value = ''
  selectedOwnerIdx.value = 0
  refreshList()
}

const refreshList = () => {
  currentPage.value = 1
  hasMore.value = true
  diaries.value = []
  fetchList()
}

const fetchList = async () => {
  if (isLoading.value || !hasMore.value) return
  isLoading.value = true
  uni.showLoading({ title: '加载中' })
  try {
    const res = await uni.cloud.callFunction({
      name: 'diaryCloud',
      data: { 
        action: 'getList', 
        payload: {
          dateFilter: selectedDate.value,
          ownerFilter: ownerValues[selectedOwnerIdx.value],
          page: currentPage.value,
          pageSize
        } 
      }
    })
    if (res.result.success) {
      const newData = res.result.data || []
      if (currentPage.value === 1) {
        diaries.value = newData
      } else {
        diaries.value.push(...newData)
      }
      if (newData.length < pageSize) {
        hasMore.value = false
      }
    }
  } catch (e) {
    uni.showToast({ title: '拉取失败', icon: 'none' })
  } finally {
    isLoading.value = false
    uni.hideLoading()
    uni.stopPullDownRefresh()
  }
}

const getAuthorPrefix = (ownerId) => {
  return ownerId === userStore.openId ? '我：' : '你：'
}

const formatTime = (ts) => formatWeChatTime(ts)

const previewImage = (current, urls) => {
  uni.previewImage({ current, urls, showmenu: true })
}

const goToDetail = (id) => {
  uni.navigateTo({ url: `/pages/diary/detail?id=${id}` })
}

const goToPublish = () => {
  uni.navigateTo({ url: '/pages/publish/publish' })
}

onShow(() => {
  if (userStore.isLoggedIn) {
    if (diaries.value.length === 0) {
      refreshList()
    }
  } else {
    uni.reLaunch({ url: '/pages/login/login' })
  }
})

onPullDownRefresh(() => {
  refreshList()
})

onReachBottom(() => {
  if (hasMore.value) {
    currentPage.value++
    fetchList()
  }
})
</script>

<style scoped>
.container {
  padding: 30rpx;
  background-color: #FFF8F0;
  min-height: 100vh;
  position: relative;
}
.filter-bar {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
  align-items: center;
}
.picker-box {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  padding: 10rpx 24rpx;
  border-radius: 30rpx;
}
.picker-text {
  font-size: 26rpx;
  color: #555;
}
.arrow {
  font-size: 20rpx;
  color: #999;
  margin-left: 10rpx;
}
.clear-btn {
  color: #FF7A59;
  font-size: 26rpx;
  padding: 10rpx;
}
.diary-list {
  display: flex;
  flex-direction: column;
  padding-bottom: 120rpx;
}
.diary-card {
  padding: 30rpx;
  border-radius: 20rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.08);
}
.my-diary {
  background: #FFFFFF;
}
.partner-diary {
  background: #FFF5F5;
}
.card-header {
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.time {
  font-size: 24rpx;
  color: #999;
}
.badge {
  font-size: 20rpx;
  background: #f0f0f0;
  color: #999;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.card-content {
  margin-bottom: 10rpx;
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
  line-clamp: 3;
  overflow: hidden;
  text-overflow: ellipsis;
}
.author {
  font-weight: bold;
  color: #FF7A59;
}
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
  margin-top: 20rpx;
}
.grid-img-wrapper {
  position: relative;
  width: 100%;
  height: 200rpx;
}
.grid-img {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
  background: #eee;
}
.more-badge {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  font-weight: bold;
  border-radius: 8rpx;
}
.empty {
  text-align: center;
  color: #999;
  margin-top: 100rpx;
}
.fab {
  position: fixed;
  right: 40rpx;
  bottom: 80rpx;
  width: 100rpx;
  height: 100rpx;
  background: #FF7A59;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 122, 89, 0.4);
  z-index: 100;
}
.fab-text {
  color: #fff;
  font-size: 60rpx;
  font-weight: 300;
  line-height: 100rpx;
  margin-top: -6rpx;
}
</style>
