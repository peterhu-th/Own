<script setup>
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'

let heartbeatTimer = null

onLaunch(() => {
  console.log('App Launch')
  // 初始化云开发环境
  if (uni.cloud) {
    uni.cloud.init({
      env: 'cloud1-d5g2obt832c1960ec',
      traceUser: true,
    })
  } else {
    console.error('请使用 2.2.3 或以上的基础库以使用云能力')
  }
})

const sendHeartbeat = (minutes = 0) => {
  const userStore = useUserStore()
  if (userStore.isLoggedIn) {
    uni.cloud.callFunction({
      name: 'authCloud',
      data: {
        action: 'heartbeat',
        payload: { sessionMinutes: minutes }
      }
    }).catch(e => console.error('Heartbeat failed', e))
  }
}

onShow(() => {
  console.log('App Show')
  sendHeartbeat(0)
  heartbeatTimer = setInterval(() => {
    sendHeartbeat(1)
  }, 60000)
})

onHide(() => {
  console.log('App Hide')
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
})
</script>

<style>
/*每个页面公共css */
page {
  background-color: #FFF8F0;
}
</style>
