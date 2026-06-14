<template>
  <view class="container">
    <view class="header">
      <text class="title">记忆窝点</text>
    </view>
    <view class="auth-box">
      <button v-if="!userStore.isLoggedIn" type="primary" :loading="loading" @click="handleLogin">进入日记本</button>
      <view v-else-if="!userStore.partnerId" class="bind-section">
        <text class="status-text">已登录</text>
        <view class="invite-code">我的邀请码：<text class="code" selectable>{{ userStore.inviteCode || '暂无' }}</text></view>
        <button open-type="share" type="primary" plain class="share-btn">分享邀请给TA</button>
        <text class="tips">发送邀请码给 TA，或在此输入 TA 的邀请码绑定：</text>
        <input class="input-code" placeholder="输入 6 位邀请码" v-model="partnerCode" maxlength="6" />
        <button type="default" :loading="binding" @click="handleBind">绑定</button>
        <button type="default" plain class="skip-btn" @click="goToIndex">暂不绑定</button>
      </view>
      <view v-else class="bind-section">
        <text class="status-text">已绑定</text>
        <button type="primary" @click="goToIndex">进入日记本</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const partnerCode = ref('')
const loading = ref(false)
const binding = ref(false)

const handleLogin = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const res = await uni.cloud.callFunction({
      name: 'authCloud',
      data: { action: 'login' }
    })
    if (res.result.success) {
      userStore.setLoginState(res.result.openId, res.result.partnerId)
      userStore.inviteCode = res.result.inviteCode
      userStore.setNicknames(res.result.myNickname, res.result.partnerNickname)
      if (res.result.partnerId) {
        uni.switchTab({ url: '/pages/index/index' })
      }
    } else {
      uni.showToast({ title: res.result.msg || '登录失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const handleBind = async () => {
  if (!partnerCode.value || partnerCode.value.length !== 6) {
    uni.showToast({ title: '请输入6位邀请码', icon: 'none' })
    return
  }
  if (binding.value) return
  binding.value = true
  try {
    const res = await uni.cloud.callFunction({
      name: 'authCloud',
      data: { action: 'bindPartner', payload: { inviteCode: partnerCode.value } }
    })
    if (res.result.success) {
      uni.showToast({ title: '绑定成功' })
      userStore.setLoginState(userStore.openId, res.result.partnerId)
      setTimeout(() => uni.switchTab({ url: '/pages/index/index' }), 1000)
    } else {
      uni.showToast({ title: res.result.msg || '绑定失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '请求失败', icon: 'none' })
  } finally {
    binding.value = false
  }
}

const goToIndex = () => {
  uni.switchTab({ url: '/pages/index/index' })
}

onLoad((options) => {
  if (options.inviteCode) {
    partnerCode.value = options.inviteCode
  }
})

onMounted(() => {
  handleLogin()
})

onShareAppMessage(() => {
  return {
    title: '邀请你绑定日记',
    path: `/pages/login/login?inviteCode=${userStore.inviteCode || ''}`
  }
})
</script>

<style scoped>
.container {
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #FFF8F0;
}
.header {
  margin-bottom: 80rpx;
  text-align: center;
}
.title {
  font-size: 56rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}
.subtitle {
  font-size: 28rpx;
  color: #666;
}
.auth-box {
  width: 100%;
}
.bind-section {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}
.status-text {
  text-align: center;
  color: #52c41a;
  font-weight: bold;
}
.invite-code {
  text-align: center;
  font-size: 32rpx;
  background: #fff;
  padding: 30rpx;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
}
.code {
  font-weight: bold;
  color: #FF7A59;
  letter-spacing: 4rpx;
  font-size: 40rpx;
  display: block;
  margin-top: 10rpx;
}
.tips {
  font-size: 26rpx;
  color: #666;
  text-align: center;
}
.input-code {
  height: 90rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 20rpx;
  text-align: center;
  background: #fff;
  font-size: 32rpx;
}
.skip-btn {
  margin-top: 10rpx;
  border: none !important;
  color: #999 !important;
  font-size: 28rpx;
}
.share-btn {
  margin-top: -10rpx;
  margin-bottom: 10rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  height: 80rpx;
  line-height: 80rpx;
}
</style>
