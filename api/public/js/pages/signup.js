import * as ethers from '/js/modules/ethers/ethers.esm.min.js'

if (typeof window.ethereum !== 'undefined') {
  const provider = new ethers.providers.Web3Provider(window.ethereum)

  const ethereumButton = document.querySelector('#enableEthereum')

  const challengeInput = document.querySelector('#challenge')
  const addressInput = document.querySelector('#address')
  const ensInput = document.querySelector('#ens')
  const emailInput = document.querySelector('#email')
  const twitterInput = document.querySelector('#twitter')
  const urlInput = document.querySelector('#url')
  const signatureInput = document.querySelector('#signature')

  ethereumButton.addEventListener('click', async (e) => {
    e.preventDefault()
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
    console.log({ accounts })
    const ens = await provider.lookupAddress(accounts[0])
    console.log({ account: accounts[0], ens })

    addressInput.value = accounts[0]
    ensInput.value = ens

    if (ens) {
      const resolver = await provider.getResolver(ens)
      const email = await resolver.getText('email')
      const url = await resolver.getText('url')
      const twitter = await resolver.getText('com.twitter')

      console.log({ email, url, twitter })

      emailInput.value = email
      urlInput.value = url
      twitterInput.value = twitter
    }

    const signer = provider.getSigner()
    const signature = await signer.signMessage(challengeInput.value)

    signatureInput.value = signature
  })
}
