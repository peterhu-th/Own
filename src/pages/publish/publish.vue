<template>
  <view class="container">
    <view class="time-selector" v-if="!editId">
      <picker mode="selector" :range="['记录此刻', '捡拾过去']" @change="onTimeModeChange">
        <view class="mode-text">{{ isBackdated ? '捡拾过去 ▼' : '记录此刻 ▼' }}</view>
      </picker>
      <view v-if="isBackdated" class="custom-time-picker">
        <picker mode="date" :value="customDate" :end="todayStr" @change="onCustomDateChange">
          <text class="picker-txt">{{ customDate || '选择日期' }}</text>
        </picker>
        <picker mode="time" :value="customTime" @change="onCustomTimeChange">
          <text class="picker-txt">{{ customTime || '选择时间' }}</text>
        </picker>
      </view>
    </view>

    <textarea class="content-input" placeholder="写下此刻的想法..." v-model="content" :maxlength="-1"></textarea>
    
    <view class="media-section">
      <view class="media-grid">
        <view class="media-item" v-for="(img, idx) in mediaPaths" :key="idx">
          <image :src="img" mode="aspectFill" class="img" />
          <view class="delete-btn" @click.stop="removeMedia(idx)">×</view>
        </view>
        <view class="add-btn" @click="chooseMedia" v-if="mediaPaths.length < 9">+</view>
      </view>
    </view>
    <button class="publish-btn" type="primary" :loading="isPublishing" :disabled="isMediaLoading" @click="publishDiary">
      {{ editId ? '保存修改' : '发布' }}
    </button>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const content = ref('')
const isBackdated = ref(false)
const customDate = ref('')
const customTime = ref('')
const mediaPaths = ref([])
const isPublishing = ref(false)
const isMediaLoading = ref(false)
const editId = ref(null)
const todayStr = ref('')

onLoad((options) => {
  const d = new Date()
  todayStr.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

  if (options.editId) {
    editId.value = options.editId
    uni.setNavigationBarTitle({ title: '修改日记' })
    fetchDiaryDetail()
  } else {
    // 尝试加载缓存的补传时间
    const cachedDate = uni.getStorageSync('lastBackdatedDate')
    const cachedTime = uni.getStorageSync('lastBackdatedTime')
    if (cachedDate) customDate.value = cachedDate
    if (cachedTime) customTime.value = cachedTime
  }
})

const fetchDiaryDetail = async () => {
  uni.showLoading({ title: '加载中' })
  try {
    const res = await uni.cloud.callFunction({
      name: 'diaryCloud',
      data: { action: 'getDetail', payload: { id: editId.value } }
    })
    if (res.result.success) {
      const diary = res.result.diary
      content.value = diary.content
      mediaPaths.value = diary.media_list || []
    }
  } finally {
    uni.hideLoading()
  }
}

const onTimeModeChange = (e) => {
  isBackdated.value = e.detail.value == 1
}
const onCustomDateChange = (e) => { customDate.value = e.detail.value }
const onCustomTimeChange = (e) => { customTime.value = e.detail.value }

const chooseMedia = () => {
  isMediaLoading.value = true
  uni.showLoading({ title: '处理媒体...' })
  uni.chooseMedia({
    count: 9 - mediaPaths.value.length,
    mediaType: ['image'],
    success: (res) => {
      mediaPaths.value.push(...res.tempFiles.map(f => f.tempFilePath))
    },
    complete: () => {
      isMediaLoading.value = false
      uni.hideLoading()
    }
  })
}

const removeMedia = (idx) => {
  mediaPaths.value.splice(idx, 1)
}

const publishDiary = async () => {
  if (!content.value.trim()) {
    uni.showToast({ title: '内容不能为空', icon: 'none' })
    return
  }
  if (!editId.value && isBackdated.value && (!customDate.value || !customTime.value)) {
    uni.showToast({ title: '请选择完整的日期和时间', icon: 'none' })
    return
  }

  isPublishing.value = true
  let customTimestamp = null
  if (!editId.value && isBackdated.value) {
    customTimestamp = new Date(`${customDate.value}T${customTime.value}:00+08:00`).getTime()
    if (customTimestamp > Date.now()) {
      uni.showToast({ title: '不能选择未来的时间', icon: 'none' })
      isPublishing.value = false
      return
    }
  }

  try {
    uni.showLoading({ title: editId.value ? '保存中...' : '上传中...' })
    const fileIds = []
    for (let path of mediaPaths.value) {
      if (path.startsWith('cloud://')) {
        fileIds.push(path)
      } else {
        const ext = path.split('.').pop()
        const cloudPath = `diaries/${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: path
        })
        fileIds.push(uploadRes.fileID)
      }
    }

    const payload = editId.value 
      ? { id: editId.value, content: content.value, media_list: fileIds }
      : { content: content.value, media_list: fileIds, is_backdated: isBackdated.value, custom_time: customTimestamp }

    const res = await uni.cloud.callFunction({
      name: 'diaryCloud',
      data: {
        action: editId.value ? 'update' : 'publish',
        payload
      }
    })

    if (res.result.success) {
      uni.showToast({ title: editId.value ? '修改成功' : '发布成功' })
      if (!editId.value && isBackdated.value) {
        uni.setStorageSync('lastBackdatedDate', customDate.value)
        uni.setStorageSync('lastBackdatedTime', customTime.value)
      }
      setTimeout(() => {
        // Return back and trigger refresh via onShow if handled
        uni.$emit('refreshDiaries')
        uni.navigateBack()
      }, 1000)
    } else {
      uni.showToast({ title: res.result.msg || '操作失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '操作异常', icon: 'none' })
  } finally {
    uni.hideLoading()
    isPublishing.value = false
  }
}
</script>

<style scoped>
.container {
  padding: 30rpx;
  background-color: #FFF8F0;
  min-height: 100vh;
}
.time-selector {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  background: #fff;
  padding: 20rpx;
  border-radius: 12rpx;
}
.mode-text {
  font-weight: bold;
  color: #FF7A59;
}
.custom-time-picker {
  display: flex;
  gap: 20rpx;
}
.picker-txt {
  background: #f5f5f5;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
}
.content-input {
  width: 100%;
  height: 400rpx;
  background: #fdfdfd;
  padding: 30rpx;
  border-radius: 20rpx;
  box-sizing: border-box;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.05);
}
.media-section {
  margin-bottom: 40rpx;
}
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}
.media-item {
  position: relative;
  width: 100%;
  height: 220rpx;
}
.img {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
}
.delete-btn {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 40rpx;
  height: 40rpx;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
}
.add-btn {
  width: 100%;
  height: 220rpx;
  background: #fff;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: #ccc;
  border: none;
  box-shadow: 0 2rpx 10rpx rgba(255, 122, 89, 0.05);
}
.publish-btn {
  margin: 0 40rpx;
  background-color: #FF7A59;
  color: #fff;
  border-radius: 40rpx;
  box-shadow: 0 8rpx 24rpx rgba(255, 122, 89, 0.3);
}
</style>
