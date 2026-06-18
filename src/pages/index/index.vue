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
      <text class="export-toggle-btn" @click="toggleExportMode">{{ isExportMode ? '取消导出' : '多选/导出' }}</text>
    </view>

    <view v-if="isExportMode" class="export-action-bar">
      <text>已选 {{ selectedExportIds.length }}/100</text>
      <button size="mini" type="primary" @click="confirmExport" :disabled="selectedExportIds.length === 0">导出为 TXT</button>
    </view>

    <view v-if="pastDiaries.length > 0 && !isExportMode" class="past-diaries-card">
      <view class="past-header">
        <text class="title">🕰️ 那年今日</text>
      </view>
      <swiper class="past-swiper" autoplay :interval="4000" circular>
        <swiper-item v-for="diary in pastDiaries" :key="diary._id" @click="goToDetail(diary._id)">
          <view class="past-item">
            <text class="past-year">{{ getYearsAgo(diary.create_time) }}年前</text>
            <text class="past-content clamp-text">{{ diary.content }}</text>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <view class="diary-list">
      <view 
        class="diary-card" 
        :class="{ 'my-diary': diary.owner_id === userStore.openId, 'partner-diary': diary.owner_id !== userStore.openId }"
        v-for="(diary, index) in diaries" 
        :key="index"
        @click="isExportMode ? toggleSelect(diary._id) : goToDetail(diary._id)"
      >
        <view class="checkbox-wrapper" v-if="isExportMode">
          <checkbox :checked="selectedExportIds.includes(diary._id)" color="#FF7A59" />
        </view>
        <view class="card-main">
        <view class="card-header">
          <text class="time">{{ formatTime(diary.create_time) }}</text>
          <text v-if="diary.is_backdated" class="badge">补传</text>
        </view>
        <view class="card-content">
          <text class="text-content clamp-text"><text class="author">{{ getAuthorPrefix(diary.owner_id) }}</text>{{ diary.content }}</text>
          
          <view class="audio-player" v-if="diary.audio_path" @click.stop="playAudio(diary.audio_path)">
            <text class="play-icon">▶️</text> <text class="play-text">点击播放语音</text>
          </view>
          
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
          <view class="card-footer">
            <text class="like-btn" @click.stop="toggleLike(diary)">❤️ {{ diary.like_count || 0 }}</text>
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

const isExportMode = ref(false)
const selectedExportIds = ref([])
const pastDiaries = ref([])

const innerAudioContext = uni.createInnerAudioContext()

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

const fetchPastDiaries = async () => {
  try {
    const res = await uni.cloud.callFunction({ name: 'diaryCloud', data: { action: 'getOnThisDay' } })
    if (res.result.success) {
      pastDiaries.value = res.result.data || []
    }
  } catch (e) {
    console.error('fetchPastDiaries error', e)
  }
}

const getYearsAgo = (ts) => {
  const d = new Date(ts)
  const now = new Date()
  return now.getFullYear() - d.getFullYear()
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

const toggleLike = async (diary) => {
  try {
    const res = await uni.cloud.callFunction({ name: 'diaryCloud', data: { action: 'toggleLike', payload: { id: diary._id } } })
    if (res.result.success) {
      diary.like_count = diary.like_count || 0
      diary.like_count += res.result.isLiked ? 1 : -1
    }
  } catch (e) {
    console.error(e)
  }
}

const playAudio = (path) => {
  if (innerAudioContext.src === path && !innerAudioContext.paused) {
    innerAudioContext.stop()
  } else {
    innerAudioContext.src = path
    innerAudioContext.play()
  }
}

const goToPublish = () => {
  uni.navigateTo({ url: '/pages/publish/publish' })
}

const toggleExportMode = () => {
  isExportMode.value = !isExportMode.value
  selectedExportIds.value = []
}

const toggleSelect = (id) => {
  const idx = selectedExportIds.value.indexOf(id)
  if (idx > -1) {
    selectedExportIds.value.splice(idx, 1)
  } else {
    if (selectedExportIds.value.length >= 100) {
      return uni.showToast({ title: '最多选择100条', icon: 'none' })
    }
    selectedExportIds.value.push(id)
  }
}

const confirmExport = () => {
  if (selectedExportIds.value.length === 0) return
  uni.showLoading({ title: '生成中...' })
  
  const selectedDiaries = diaries.value.filter(d => selectedExportIds.value.includes(d._id))
  
  let txtContent = ''
  selectedDiaries.forEach(d => {
    const timeStr = formatTime(d.create_time)
    const authorStr = getAuthorPrefix(d.owner_id).replace('：', '')
    txtContent += `【${timeStr}】(${authorStr}) \n${d.content}\n\n`
  })
  
  const fs = wx.getFileSystemManager()
  const filePath = `${wx.env.USER_DATA_PATH}/导出日记_${Date.now()}.txt`
  
  fs.writeFile({
    filePath,
    data: txtContent,
    encoding: 'utf8',
    success() {
      uni.hideLoading()
      wx.shareFileMessage({
        filePath,
        success() {
          isExportMode.value = false
          selectedExportIds.value = []
        },
        fail() {
          uni.showToast({ title: '已取消分享', icon: 'none' })
        }
      })
    },
    fail(err) {
      uni.hideLoading()
      uni.showToast({ title: '生成文件失败', icon: 'none' })
      console.error('Export error', err)
    }
  })
}

onShow(() => {
  if (userStore.isLoggedIn) {
    if (diaries.value.length === 0) {
      refreshList()
    }
    fetchPastDiaries()
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
  display: flex;
  padding: 30rpx;
  border-radius: 20rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.08);
  align-items: flex-start;
}
.checkbox-wrapper {
  margin-right: 20rpx;
  margin-top: 10rpx;
}
.card-main {
  flex: 1;
  overflow: hidden;
}
.export-toggle-btn {
  color: #FF7A59;
  font-size: 26rpx;
  padding: 10rpx;
  margin-left: auto;
}
.export-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 20rpx 30rpx;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
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
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
  margin-top: 20rpx;
}
.card-footer {
  margin-top: 20rpx;
  display: flex;
  justify-content: flex-end;
}
.like-btn {
  font-size: 26rpx;
  color: #FF7A59;
  font-weight: bold;
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
.export-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 20rpx 30rpx;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);
}
.past-diaries-card {
  background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 6rpx 20rpx rgba(255, 154, 158, 0.3);
}
.past-header {
  margin-bottom: 20rpx;
}
.past-header .title {
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
}
.past-swiper {
  height: 160rpx;
}
.past-item {
  display: flex;
  flex-direction: column;
}
.past-year {
  font-size: 24rpx;
  color: rgba(255,255,255,0.9);
  margin-bottom: 8rpx;
}
.past-content {
  font-size: 30rpx;
  color: #fff;
  line-height: 1.5;
}
</style>
