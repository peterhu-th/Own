<template>
  <view class="container">
    <view class="header-options">
      <picker v-if="!editId" mode="selector" :range="['记录此刻', '捡拾过去']" @change="onTimeModeChange">
        <view class="mode-text">{{ isBackdated ? '捡拾过去 ▼' : '记录此刻 ▼' }}</view>
      </picker>
      <view v-else></view>

      <picker mode="selector" :range="['完全私密', '绑定可见', '公开']" :value="visibilityIndex" @change="onVisibilityChange">
        <view class="visibility-text">{{ ['完全私密', '绑定可见', '公开'][visibilityIndex] }} ▼</view>
      </picker>
    </view>

    <view v-if="!editId && isBackdated" class="custom-time-picker">
      <picker mode="date" :value="customDate" :end="todayStr" @change="onCustomDateChange">
        <text class="picker-txt">{{ customDate || '选择日期' }}</text>
      </picker>
      <picker mode="time" :value="customTime" @change="onCustomTimeChange">
        <text class="picker-txt">{{ customTime || '选择时间' }}</text>
      </picker>
    </view>

    <view class="input-wrapper">
      <textarea class="content-input" :style="{ height: textareaHeight }" @linechange="onLineChange" placeholder="写下此刻的想法..." v-model="content" :maxlength="-1"></textarea>
      <button class="voice-btn" type="default" size="mini" @click="toggleRecord">
        {{ isRecording ? '结束录音' : '开始录音' }}
      </button>
    </view>
    <view class="text-toggle-bar" v-if="showTextToggle">
      <text class="toggle-text" @click="isTextExpanded = !isTextExpanded">{{ isTextExpanded ? '收起' : '展开' }}</text>
    </view>
    
    <view class="audio-section" v-if="audioPath">
      <view class="audio-card">
        <text class="play-btn" @click="playAudio">{{ isPlaying ? '⏹ 停止' : '▶️ 播放' }} {{ audioDuration ? audioDuration + 's' : '' }}</text>
        <text class="delete-audio" @click="removeAudio">删除</text>
      </view>
    </view>
    
    <view class="media-section">
      <view class="media-grid">
        <template v-for="(img, idx) in mediaPaths" :key="idx">
          <view class="media-item" v-if="isMediaExpanded || idx < 3">
            <image :src="img" mode="aspectFill" class="img" />
            <view class="delete-btn" @click.stop="removeMedia(idx)">×</view>
            <view class="mask-overlay" v-if="!isMediaExpanded && idx === 2 && mediaPaths.length > 3" @click="isMediaExpanded = true">
              <text>+{{ mediaPaths.length - 3 }}</text>
            </view>
          </view>
        </template>
        <view class="add-btn" @click="chooseMedia" v-if="isMediaExpanded || mediaPaths.length < 3">+</view>
      </view>
      <view class="media-toggle-bar" v-if="isMediaExpanded && mediaPaths.length > 3">
        <text class="toggle-text" @click="isMediaExpanded = false">收起</text>
      </view>
    </view>
    <button class="publish-btn" type="primary" :loading="isPublishing" :disabled="isMediaLoading" @click="publishDiary">
      {{ editId ? '保存' : '发布' }}
    </button>
  </view>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'

const content = ref('')
const isBackdated = ref(false)
const customDate = ref('')
const customTime = ref('')
const mediaPaths = ref([])
const isPublishing = ref(false)
const isMediaLoading = ref(false)
const editId = ref(null)
const todayStr = ref('')
const visibilityIndex = ref(1) // Default to partner
const visibilityMap = ['private', 'partner', 'public']
const audioPath = ref('')
const isRecording = ref(false)
const isPlaying = ref(false)
const isTextExpanded = ref(false)
const isMediaExpanded = ref(false)
const audioDuration = ref(0)

const textContentHeightPx = ref(0)
const showTextToggle = ref(false)

const onLineChange = (e) => {
  textContentHeightPx.value = e.detail.height
  const minFullHeight = uni.upx2px(400)
  const paddingHeight = uni.upx2px(110)
  if (e.detail.height + paddingHeight > minFullHeight) {
    showTextToggle.value = true
  } else {
    showTextToggle.value = false
    isTextExpanded.value = false
  }
}

const textareaHeight = computed(() => {
  if (!isTextExpanded.value) return '400rpx'
  return `${textContentHeightPx.value + uni.upx2px(110)}px`
})

watch(mediaPaths, (newVal) => {
  if (newVal.length <= 3) {
    isMediaExpanded.value = false
  }
}, { deep: true })

const recorderManager = uni.getRecorderManager()
const innerAudioContext = uni.createInnerAudioContext()

recorderManager.onStop((res) => {
  audioPath.value = res.tempFilePath
  audioDuration.value = Math.ceil(res.duration / 1000)
})

innerAudioContext.onPlay(() => {
  isPlaying.value = true
})

innerAudioContext.onEnded(() => {
  isPlaying.value = false
})

innerAudioContext.onStop(() => {
  isPlaying.value = false
})

onUnload(() => {
  if (innerAudioContext) {
    innerAudioContext.stop()
    innerAudioContext.destroy()
  }
})

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
    
    if (options.visibility) {
      const vIdx = visibilityMap.indexOf(options.visibility)
      if (vIdx !== -1) visibilityIndex.value = vIdx
    }
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
      audioPath.value = diary.audio_path || ''
      const vIdx = visibilityMap.indexOf(diary.visibility)
      if (vIdx !== -1) visibilityIndex.value = vIdx
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
const onVisibilityChange = (e) => { visibilityIndex.value = e.detail.value }

const toggleRecord = () => {
  if (isRecording.value) {
    isRecording.value = false
    recorderManager.stop()
  } else {
    uni.authorize({
      scope: 'scope.record',
      success() {
        isRecording.value = true
        recorderManager.start({ duration: 60000, format: 'mp3' })
      },
      fail() {
        uni.showModal({
          title: '权限申请',
          content: '录音功能需要麦克风权限，是否前往设置开启？',
          success(res) {
            if (res.confirm) {
              uni.openSetting()
            }
          }
        })
      }
    })
  }
}

const playAudio = () => {
  if (isPlaying.value) {
    innerAudioContext.stop()
  } else {
    innerAudioContext.src = audioPath.value
    innerAudioContext.play()
  }
}

const removeAudio = () => {
  audioPath.value = ''
  audioDuration.value = 0
  innerAudioContext.stop()
}

const chooseMedia = () => {
  if (mediaPaths.value.length >= 9) {
    uni.showToast({ title: '最多只能上传9张图片', icon: 'none' })
    return
  }
  isMediaLoading.value = true
  uni.showLoading({ title: '处理媒体...' })
  uni.chooseMedia({
    count: 9,
    mediaType: ['image'],
    success: (res) => {
      const remaining = 9 - mediaPaths.value.length
      if (res.tempFiles.length > remaining) {
        uni.showToast({ title: '最多只能上传9张图片', icon: 'none', duration: 2000 })
        mediaPaths.value.push(...res.tempFiles.slice(0, remaining).map(f => f.tempFilePath))
      } else {
        mediaPaths.value.push(...res.tempFiles.map(f => f.tempFilePath))
      }
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

    let uploadedAudioPath = audioPath.value
    if (audioPath.value && !audioPath.value.startsWith('cloud://')) {
      const ext = audioPath.value.split('.').pop() || 'mp3'
      const cloudAudioPath = `audios/${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`
      const uploadAudioRes = await wx.cloud.uploadFile({
        cloudPath: cloudAudioPath,
        filePath: audioPath.value
      })
      uploadedAudioPath = uploadAudioRes.fileID
    }

    const payload = editId.value 
      ? { id: editId.value, content: content.value, media_list: fileIds, audio_path: uploadedAudioPath, visibility: visibilityMap[visibilityIndex.value] }
      : { content: content.value, media_list: fileIds, audio_path: uploadedAudioPath, is_backdated: isBackdated.value, custom_time: customTimestamp, visibility: visibilityMap[visibilityIndex.value] }

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
.header-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  background: #fff;
  padding: 20rpx 30rpx;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.05);
}
.mode-text {
  font-weight: bold;
  color: #666;
  font-size: 28rpx;
}
.custom-time-picker {
  display: flex;
  gap: 20rpx;
  margin-bottom: 30rpx;
}
.picker-txt {
  background: #fff;
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #555;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.05);
}
.visibility-text {
  font-size: 28rpx;
  color: #666;
  font-weight: bold;
}
.input-wrapper {
  position: relative;
  margin-bottom: 30rpx;
}
.content-input {
  width: 100%;
  height: 400rpx;
  min-height: 400rpx;
  background: #fdfdfd;
  padding: 30rpx;
  padding-bottom: 80rpx;
  border-radius: 20rpx;
  box-sizing: border-box;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.05);
}
.text-toggle-bar, .media-toggle-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 30rpx;
}
.media-toggle-bar {
  margin-top: 30rpx;
}
.toggle-text {
  font-size: 26rpx;
  color: #FF7A59;
}
.voice-btn {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  z-index: 10;
  border-radius: 40rpx;
  font-size: 24rpx;
  color: #FF7A59;
  border: 1px solid #FF7A59;
  background-color: transparent;
}
.audio-section {
  margin-bottom: 30rpx;
}
.audio-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 20rpx 30rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 122, 89, 0.05);
}
.play-btn {
  font-size: 28rpx;
  color: #333;
}
.delete-audio {
  font-size: 26rpx;
  color: #e64340;
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
  z-index: 10;
}
.mask-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}
.mask-overlay text {
  color: #fff;
  font-size: 48rpx;
  font-weight: bold;
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
