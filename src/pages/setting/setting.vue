<template>
  <view class="container">
    <view class="danger-zone" v-if="userStore.partnerId">
      <text class="title">关系管理</text>
      <text class="desc">解绑后将触发 72 小时冷静期（测试环境下可通过全局变量关闭）。确认解绑后您的日记将不再对 TA 可见，且双方交叉批注将被全部清空且无法恢复。</text>
      
      <button v-if="!unbindRequestTime" type="warn" :loading="isRequesting" @click="requestUnbind">申请解绑</button>
      
      <view v-else class="cooldown-box">
        <text class="cooldown-text">已申请解绑</text>
        <button class="action-btn" type="default" :loading="isRequesting" @click="cancelUnbind">撤销申请</button>
        <button class="action-btn" type="warn" :loading="isRequesting" @click="confirmUnbind">确认解绑</button>
        <button class="action-btn download-btn" type="primary" plain @click="downloadData">打包我们的回忆</button>
      </view>
    </view>
    <view class="empty-zone" v-else>
      <text>当前未绑定</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const unbindRequestTime = ref(null)
const unbindInitiator = ref(null)
const isRequesting = ref(false)

const fetchStatus = async () => {
  const res = await uni.cloud.callFunction({ name: 'userCloud', data: { action: 'getProfile' } })
  if (res.result.success) {
    unbindRequestTime.value = res.result.myData.unbind_request_time
    unbindInitiator.value = res.result.myData.unbind_initiator
  }
}

const requestUnbind = async () => {
  if (isRequesting.value) return
  isRequesting.value = true
  try {
    const res = await uni.cloud.callFunction({ name: 'lifeCycleCloud', data: { action: 'requestUnbind' } })
    if (res.result.success) {
      uni.showToast({ title: '已申请解绑', icon: 'none' })
      fetchStatus()
    }
  } finally {
    isRequesting.value = false
  }
}

const cancelUnbind = async () => {
  if (isRequesting.value) return
  isRequesting.value = true
  try {
    const res = await uni.cloud.callFunction({ name: 'lifeCycleCloud', data: { action: 'cancelUnbind' } })
    if (res.result.success) {
      uni.showToast({ title: '已撤销', icon: 'none' })
      fetchStatus()
    }
  } finally {
    isRequesting.value = false
  }
}

const confirmUnbind = async () => {
  if (isRequesting.value) return
  isRequesting.value = true
  try {
    const res = await uni.cloud.callFunction({ name: 'lifeCycleCloud', data: { action: 'confirmUnbind' } })
    if (res.result.success) {
      uni.showToast({ title: '解绑成功', icon: 'none' })
      userStore.partnerId = null
      fetchStatus()
    } else {
      uni.showToast({ title: res.result.msg || '操作失败', icon: 'none' })
    }
  } finally {
    isRequesting.value = false
  }
}

const downloadData = async () => {
  uni.showLoading({ title: '打包中' })
  try {
    const res = await uni.cloud.callFunction({ name: 'lifeCycleCloud', data: { action: 'exportData' } })
    if (res.result.success) {
      uni.setClipboardData({
        data: res.result.fileUrl,
        success: () => uni.showToast({ title: '链接已复制，请在浏览器中下载', icon: 'none' })
      })
    }
  } finally {
    uni.hideLoading()
  }
}

onShow(() => {
  if (userStore.isLoggedIn && userStore.partnerId) {
    fetchStatus()
  }
})
</script>

<style scoped>
.container {
  padding: 40rpx;
  background-color: #FFF8F0;
  min-height: 100vh;
}
.danger-zone {
  background: #fff;
  padding: 40rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05);
}
.empty-zone {
  text-align: center;
  color: #999;
  padding: 100rpx 0;
}
.title {
  font-size: 34rpx;
  font-weight: bold;
  color: #e64340;
  margin-bottom: 20rpx;
  display: block;
}
.desc {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 40rpx;
  display: block;
  line-height: 1.5;
}
.cooldown-box {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.cooldown-text {
  text-align: center;
  color: #e64340;
  font-weight: bold;
  margin-bottom: 20rpx;
}
.action-btn {
  width: 100%;
}
.download-btn {
  margin-top: 20rpx;
  border-color: #FF7A59 !important;
  color: #FF7A59 !important;
}
</style>
