<template>
  <view class="container">
    <view class="profile-header" v-if="profileData">
      <view class="avatar-box">
        <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image class="avatar" :src="profileData.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
        </button>
      </view>
      <input 
        type="nickname" 
        class="nickname-input" 
        :value="profileData.nickname" 
        @blur="onNicknameBlur" 
        placeholder="设置昵称" 
      />
      <text class="bind-status">{{ partnerData ? '已绑定' : '未绑定' }}</text>
      <view class="partner-status" v-if="partnerData">
        <view :class="['status-dot-inline', partnerData.is_online ? 'online' : 'offline']"></view>
        <text class="status-text">Ta当前{{ partnerData.is_online ? '在线' : '离线' }}</text>
      </view>
      
      <view class="stats">
        <text class="stat-item">累积在线: <text class="highlight">{{ profileData.total_online_minutes }}</text> 分钟</text>
        <text class="stat-item" v-if="partnerData">Ta累积在线: <text class="highlight">{{ partnerData.total_online_minutes }}</text> 分钟</text>
      </view>
    </view>

    <view class="activity-section">
      <view class="section-header" @click="toggleTimeline">
        <text class="section-title">动态记录</text>
        <text class="toggle-text">{{ isTimelineExpanded ? '收起 ▼' : '展开 ▶' }}</text>
      </view>
      <view class="timeline-list" v-show="isTimelineExpanded">
        <view 
          class="timeline-item" 
          v-for="(log, index) in activityLogs" 
          :key="index"
          @click="onActivityClick(log)"
          :class="{ 'clickable': log.type === 'diary' || log.type === 'comment' }"
        >
          <view class="timeline-dot"></view>
          <view class="timeline-content">
            <text class="time">{{ formatTime(log.timestamp) }}</text>
            <text class="action">{{ getAuthorPrefix(log.user_id) }}{{ log.action }}</text>
          </view>
        </view>
        <view v-if="activityLogs.length === 0" class="empty">暂无动态</view>
      </view>
    </view>
    <view class="menu-list">
      <view class="menu-item" @click="goToLiked" hover-class="menu-hover">
        <view class="menu-item-left">
          <text class="menu-icon">❤️</text>
          <text class="menu-text">我赞过的</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goToSettings" hover-class="menu-hover">
        <view class="menu-item-left">
          <text class="menu-icon">⚙️</text>
          <text class="menu-text">系统设置</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { formatWeChatTime } from '@/utils/time'

const userStore = useUserStore()
const profileData = ref(null)
const partnerData = ref(null)
const activityLogs = ref([])
const isTimelineExpanded = ref(false)

const toggleTimeline = () => {
  isTimelineExpanded.value = !isTimelineExpanded.value
}

const fetchProfile = async () => {
  try {
    const res = await uni.cloud.callFunction({ name: 'userCloud', data: { action: 'getProfile' } })
    if (res.result.success) {
      profileData.value = res.result.myData
      partnerData.value = res.result.partnerData
      
      const myNick = res.result.myData.nickname
      const pNick = res.result.partnerData ? res.result.partnerData.nickname : ''
      userStore.setNicknames(myNick, pNick)
    }
  } catch (e) {
    console.error(e)
  }
}

const onChooseAvatar = async (e) => {
  const { avatarUrl } = e.detail
  if (!avatarUrl) return
  try {
    uni.showLoading({ title: '更新头像' })
    const ext = avatarUrl.split('.').pop() || 'png'
    const cloudPath = `avatars/${userStore.openId}_${Date.now()}.${ext}`
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl
    })
    const fileID = uploadRes.fileID
    profileData.value.avatarUrl = fileID
    await uni.cloud.callFunction({
      name: 'userCloud',
      data: { action: 'updateProfile', payload: { avatarUrl: fileID } }
    })
    uni.hideLoading()
    uni.showToast({ title: '更新头像成功', icon: 'none' })
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

const onNicknameBlur = async (e) => {
  const newNickname = e.detail.value
  if (!newNickname || newNickname === profileData.value.nickname) return
  
  profileData.value.nickname = newNickname
  userStore.setNicknames(newNickname, userStore.partnerNickname)
  try {
    await uni.cloud.callFunction({
      name: 'userCloud',
      data: { action: 'updateProfile', payload: { nickname: newNickname } }
    })
    uni.showToast({ title: '更新昵称成功', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

const fetchLogs = async () => {
  try {
    const res = await uni.cloud.callFunction({ name: 'userCloud', data: { action: 'getActivityLogs' } })
    if (res.result.success) {
      activityLogs.value = res.result.data
    }
  } catch (e) {
    console.error(e)
  } finally {
    uni.stopPullDownRefresh()
  }
}

const getAuthorPrefix = (ownerId) => {
  if (ownerId === userStore.openId) return userStore.myNickname ? userStore.myNickname + '：' : '我：'
  return userStore.partnerNickname ? userStore.partnerNickname + '：' : '你：'
}

const formatTime = (ts) => formatWeChatTime(ts)

const onActivityClick = (log) => {
  if ((log.type === 'diary' || log.type === 'comment') && log.target_id) {
    let target = log.target_id
    uni.navigateTo({ url: `/pages/diary/detail?id=${target}` })
  }
}

const goToSettings = () => {
  uni.navigateTo({ url: '/pages/setting/setting' })
}

const goToLiked = () => {
  uni.navigateTo({ url: '/pages/user/likedDiaries' })
}

onShow(() => {
  if (userStore.isLoggedIn) {
    fetchProfile()
    fetchLogs()
  }
})

onPullDownRefresh(() => {
  fetchProfile()
  fetchLogs()
})
</script>

<style scoped>
.container {
  padding: 40rpx;
  background-color: #FFF8F0;
  min-height: 100vh;
}
.profile-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  padding: 60rpx 0;
  border-radius: 20rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
}
.avatar-box {
  position: relative;
  width: 160rpx;
  height: 160rpx;
}
.avatar-btn {
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: none;
  background: transparent;
  outline: none;
}
.avatar-btn::after {
  border: none;
}
.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #eee;
}
.partner-status {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  background: #f9f9f9;
  padding: 12rpx 30rpx;
  border-radius: 30rpx;
}
.status-dot-inline {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  margin-right: 12rpx;
}
.status-text {
  font-size: 26rpx;
  color: #555;
  font-weight: bold;
}
.online { background-color: #8FBC8F; }
.offline { background-color: #d9d9d9; }
.nickname-input {
  margin-top: 20rpx;
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  width: 80%;
}
.bind-status {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #999;
  background-color: #f5f5f5;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}
.status-text {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #666;
}
.stats {
  margin-top: 30rpx;
  font-size: 26rpx;
  color: #999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.highlight {
  color: #FF7A59;
  font-weight: bold;
  font-size: 30rpx;
  margin: 0 4rpx;
}
.activity-section {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
  margin-bottom: 40rpx;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: bold;
}
.toggle-text {
  font-size: 26rpx;
  color: #999;
}
.timeline-list {
  position: relative;
  padding-left: 30rpx;
  margin-top: 20rpx;
}
.timeline-list::before {
  content: '';
  position: absolute;
  left: 9rpx;
  top: 10rpx;
  bottom: 0;
  width: 2rpx;
  background-color: #eee;
}
.timeline-item {
  position: relative;
  margin-bottom: 40rpx;
  padding-left: 40rpx;
}
.timeline-dot {
  position: absolute;
  left: -27rpx;
  top: 10rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background-color: #FF7A59;
  border: 4rpx solid #fff;
  box-shadow: 0 0 0 2rpx rgba(255,122,89,0.2);
}
.timeline-content {
  display: flex;
  flex-direction: column;
}
.clickable .timeline-content {
  background-color: #fafafa;
  border-radius: 12rpx;
  padding: 20rpx;
}
.time {
  color: #999;
  font-size: 24rpx;
  margin-bottom: 10rpx;
}
.action {
  color: #333;
  font-size: 28rpx;
}
.menu-list {
  background: #fff;
  border-radius: 20rpx;
  padding: 0 30rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
}
.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  transition: opacity 0.2s;
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-item-left {
  display: flex;
  align-items: center;
}
.menu-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}
.menu-text {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
}
.menu-arrow {
  color: #ccc;
  font-size: 40rpx;
  line-height: 1;
}
.menu-hover {
  opacity: 0.7;
}
.empty {
  text-align: center;
  color: #999;
  padding: 40rpx 0;
}
</style>
