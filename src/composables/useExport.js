import { ref } from 'vue'

export function useExport(diariesRef) {
  const isExportMode = ref(false)
  const selectedExportIds = ref([])

  const toggleExportMode = () => {
    isExportMode.value = !isExportMode.value
    if (!isExportMode.value) selectedExportIds.value = []
  }

  const handleLongPress = (id) => {
    if (!isExportMode.value) {
      isExportMode.value = true
      selectedExportIds.value.push(id)
    }
  }

  const toggleSelect = (id) => {
    const idx = selectedExportIds.value.indexOf(id)
    if (idx === -1) {
      if (selectedExportIds.value.length >= 100) {
        uni.showToast({ title: '最多选择100条', icon: 'none' })
        return
      }
      selectedExportIds.value.push(id)
    } else {
      selectedExportIds.value.splice(idx, 1)
    }
  }

  const confirmExport = (formatTextFn) => {
    if (selectedExportIds.value.length === 0) return
    uni.showLoading({ title: '生成中...' })
    
    const selectedDiaries = diariesRef.value.filter(d => selectedExportIds.value.includes(d._id))
    
    let txtContent = ''
    selectedDiaries.forEach(d => {
      txtContent += formatTextFn(d) + '\n\n'
    })
    
    // #ifdef MP-WEIXIN
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
    // #endif
    // #ifndef MP-WEIXIN
    uni.hideLoading()
    uni.showToast({ title: '当前环境不支持导出', icon: 'none' })
    // #endif
  }

  return {
    isExportMode,
    selectedExportIds,
    toggleExportMode,
    handleLongPress,
    toggleSelect,
    confirmExport
  }
}
