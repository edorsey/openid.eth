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

    // document.querySelector('#selectChain').classList.add('is-hidden')
    document.querySelector('#connectChain').classList.remove('is-hidden')

    const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
    const ens = await provider.lookupAddress(accounts[0])

    addressInput.value = accounts[0]
    ensInput.value = ens

    if (ens) {
      const resolver = await provider.getResolver(ens)
      const email = await resolver.getText('email')
      const url = await resolver.getText('url')
      const twitter = await resolver.getText('com.twitter')

      emailInput.value = email
      urlInput.value = url
      twitterInput.value = twitter
    }

    const signer = provider.getSigner()
    const signature = await signer.signMessage(challengeInput.value)

    signatureInput.value = signature
  })
}
