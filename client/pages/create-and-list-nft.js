import { useState } from 'react'
import Web3 from 'web3'
import Web3Modal from 'web3modal'
import { useRouter } from 'next/router'
import { create as ipfsHttpClient } from 'ipfs-http-client'
import Marketplace from '../contracts/ethereum-contracts/Marketplace.json'
import BoredPetsNFT from '../contracts/ethereum-contracts/BoredPetsNFT.json'


const projectId = process.env["NEXT_PUBLIC_IPFS_PROJECT_ID"];
const projectSecret = process.env["NEXT_PUBLIC_IPFS_SECRET"];
const auth =
    'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

const client = ipfsHttpClient({
    host: 'ipfs.infura.io',
    port: 5001,
    protocol: 'https',
    headers: {
        authorization: auth,
    },
});

export default function CreateItem() {
  const [fileUrl, setFileUrl] = useState(null)
  const [formInput, updateFormInput] = useState({ price: '', name: '', description: '' })
  const router = useRouter()

  async function onChange(e) {
    // upload image to IPFS
    const file = e.target.files[0]
    console.log(projectId)
    console.log(projectSecret)
    console.log(auth)
    try {
      const added = await client.add(
        file,
        {
          progress: (prog) => console.log(`received: ${prog}`)
        }
      )
      console.log(1111)
      const url = `https://garen.infura-ipfs.io/ipfs/${added.path}`
      setFileUrl(url)
    } catch (error) {
      console.log('Error uploading file: ', error)
    }  
  }

  async function uploadToIPFS() {
    const { name, description, price } = formInput
    if (!name || !description || !price || !fileUrl) {
      return
    } else {
      // first, upload metadata to IPFS
      const data = JSON.stringify({
        name, description, image: fileUrl
      })
      try {
        const added = await client.add(data)
        console.log('added: ', added)
        const url = `https://garen.infura-ipfs.io/ipfs/${added.path}`
        // after metadata is uploaded to IPFS, return the URL to use it in the transaction
        console.log('finish uploading')
        return url
      } catch (error) {
        console.log('Error uploading file: ', error)
      } 
    }
  }

  async function listNFTForSale() {
    const web3Modal = new Web3Modal()
    const provider = await web3Modal.connect()
    const web3 = new Web3(provider)
    const url = await uploadToIPFS()
    const networkId = await web3.eth.net.getId()

    // Mint the NFT
    const boredPetsContractAddress = BoredPetsNFT.networks[networkId].address
    const boredPetsContract = new web3.eth.Contract(BoredPetsNFT.abi, boredPetsContractAddress)
    const accounts = await web3.eth.getAccounts()
    const marketPlaceContract = new web3.eth.Contract(Marketplace.abi, Marketplace.networks[networkId].address)
    let listingFee = await marketPlaceContract.methods.LISTING_FEE().call()
    console.log(url)
    boredPetsContract.methods.mint(url).send( {from: accounts[0] }).on('receipt', function (receipt) {
        console.log('minted');
        // List the NFT
        const tokenId = receipt.events.NFTMinted.returnValues[0];
        marketPlaceContract.methods.listNft(boredPetsContractAddress, tokenId, Web3.utils.toWei(formInput.price, "ether"))
            .send({ from: accounts[0], value: listingFee }).on('receipt', function () {
                console.log('listed')
                router.push('/')
            });
    });
  }

  return (
    <div className="flex justify-center">
      <div className="w-1/2 flex flex-col pb-12">
        <input 
          placeholder="Asset Name"
          className="mt-8 border rounded p-4"
          onChange={e => updateFormInput({ ...formInput, name: e.target.value })}
        />
        <textarea
          placeholder="Asset Description"
          className="mt-2 border rounded p-4"
          onChange={e => updateFormInput({ ...formInput, description: e.target.value })}
        />
        <input
          placeholder="Asset Price in Eth"
          className="mt-2 border rounded p-4"
          onChange={e => updateFormInput({ ...formInput, price: e.target.value })}
        />
        <input
          type="file"
          name="Asset"
          className="my-4"
          onChange={onChange}
        />
        {
          fileUrl && (
            <img className="rounded mt-4" width="350" src={fileUrl} />
          )
        }
        <button onClick={listNFTForSale} className="font-bold mt-4 bg-teal-400 text-white rounded p-4 shadow-lg">
          Mint and list NFT
        </button>
      </div>
    </div>
  )
}
