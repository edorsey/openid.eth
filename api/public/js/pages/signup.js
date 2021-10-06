import * as ethers from '/js/modules/ethers/ethers.esm.min.js'

const enableEthereumButton = document.querySelector('#enableEthereum')
const tezosButton = document.querySelector('#enableTezos')
const solanaButton = document.querySelector('#enableSolana')

const ethereumErrorDiv = document.querySelector('#ethereumError')

const challengeInput = document.querySelector('#challenge')
const addressInput = document.querySelector('#address')
const ensInput = document.querySelector('#ens')
const emailInput = document.querySelector('#email')
const twitterInput = document.querySelector('#twitter')
const urlInput = document.querySelector('#url')
const signatureInput = document.querySelector('#signature')
const waitingForSignatureDiv = document.querySelector('#waitingForSignature')

const selectChainSection = document.querySelector('#selectChain')
const connectChainSection = document.querySelector('#connectChain')

const profileTitleHeader = document.querySelector('#profileTitle')
const profileSubtitleHeader = document.querySelector('#profileSubtitle')
const profileUrlDiv = document.querySelector('#profileUrl')
const profileTwitterDiv = document.querySelector('#profileTwitter')
const profileEmailDiv = document.querySelector('#profileEmail')

const signupForm = document.querySelector('#signupForm')

const connectChain = () => {
  selectChainSection.classList.add('is-hidden')
  connectChainSection.classList.remove('is-hidden')
}

const selectChain = () => {
  selectChainSection.classList.remove('is-hidden')
  connectChainSection.classList.add('is-hidden')
}

enableEthereumButton.addEventListener('click', async (e) => {
  e.preventDefault()

  if (typeof window.ethereum !== 'undefined') {
    ethereumErrorDiv.classList.add('is-hidden')
    waitingForSignatureDiv.classList.add('is-hidden')

    const accounts = await ethereum.request({ method: 'eth_requestAccounts' })

    connectChain()

    const provider = new ethers.providers.Web3Provider(window.ethereum)

    const address = accounts[0]
    const ens = await provider.lookupAddress(address)

    addressInput.value = address

    if (ens) {
      profileTitleHeader.textContent = ens
      profileSubtitleHeader.textContent = address
    } else {
      profileTitleHeader.textContent = address
      profileSubtitleHeader.textContent = ''
    }

    if (ens) {
      const resolver = await provider.getResolver(ens)
      const email = await resolver.getText('email')
      const url = await resolver.getText('url')
      const twitter = await resolver.getText('com.twitter')

      if (url) {
        const a = document.createElement('a')
        const linkText = document.createTextNode(url)
        a.appendChild(linkText)
        a.title = url
        a.target = '_blank'
        a.href = `http://${url}`
        profileUrlDiv.replaceChildren(a)
        profileUrlDiv.classList.remove('is-hidden')
      } else {
        profileUrlDiv.classList.add('is-hidden')
      }

      if (twitter) {
        const a = document.createElement('a')
        const linkText = document.createTextNode(`@${twitter}`)
        a.appendChild(linkText)
        a.title = twitter
        a.target = '_blank'
        a.href = `http://twitter.com/${twitter}`
        profileTwitterDiv.replaceChildren(a)
        profileTwitterDiv.classList.remove('is-hidden')
      } else {
        profileTwitterDiv.classList.add('is-hidden')
      }

      if (email) {
        const a = document.createElement('a')
        const linkText = document.createTextNode(email)
        a.appendChild(linkText)
        a.title = email
        a.target = '_blank'
        a.href = `mailto:${email}`
        profileEmailDiv.replaceChildren(a)
        profileEmailDiv.classList.remove('is-hidden')
      } else {
        profileEmailDiv.classList.add('is-hidden')
      }
    }

    waitingForSignatureDiv.classList.remove('is-hidden')

    const signer = provider.getSigner()
    try {
      const signature = await signer.signMessage(challengeInput.value)

      signatureInput.value = signature
    } catch (err) {
      selectChain()
      return
    }

    waitingForSignatureDiv.classList.add('is-hidden')
    console.log('SUBMITTING')
    signupForm.submit()
    console.log('HERE', signupForm)
  } else {
    ethereumErrorDiv.classList.remove('is-hidden')
  }
})
