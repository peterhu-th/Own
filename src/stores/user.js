import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    isLoggedIn: false,
    openId: null,
    partnerId: null,
    isPartnerOnline: false,
    totalOnlineMinutes: 0,
    myNickname: '',
    partnerNickname: '',
    anonymousName: ''
  }),
  actions: {
    setLoginState(openId, partnerId = null) {
      this.isLoggedIn = true
      this.openId = openId
      this.partnerId = partnerId
    },
    setPartnerState(isOnline, minutes) {
      this.isPartnerOnline = isOnline
      this.totalOnlineMinutes = minutes
    },
    setNicknames(mine, partner) {
      this.myNickname = mine
      this.partnerNickname = partner
    },
    setAnonymousName(name) {
      this.anonymousName = name
    },
    logout() {
      this.isLoggedIn = false
      this.openId = null
      this.partnerId = null
      this.myNickname = ''
      this.partnerNickname = ''
    }
  }
})
