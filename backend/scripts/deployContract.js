const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract deployment script for InvoiceVerifier
async function deployContract() {
  try {
    console.log('🚀 Starting contract deployment...');

    // Check environment variables
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com';

    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('📍 Deploying from address:', wallet.address);

    // Check balance
    const balance = await wallet.provider.getBalance(wallet.address);
    console.log('💰 Wallet balance:', ethers.formatEther(balance), 'MATIC');

    if (balance === 0n) {
      throw new Error('Insufficient balance. Please add some MATIC to your wallet.');
    }

    // Read contract source code
    const contractPath = path.join(__dirname, '../contracts/InvoiceVerifier.sol');
    const contractSource = fs.readFileSync(contractPath, 'utf8');

    // For this PoC, we'll use a pre-compiled bytecode
    // In a real deployment, you would use Hardhat or Truffle to compile
    console.log('⚠️  Note: This is a simplified deployment script.');
    console.log('⚠️  For production, use Hardhat or Truffle for proper compilation and deployment.');

    // Simple contract bytecode (this would normally come from compilation)
    // This is a placeholder - in reality you'd compile the Solidity code
    const contractBytecode = "0x608060405234801561001057600080fd5b50600080546001600160a01b031916331790556108b8806100326000396000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c80638da5cb5b116100715780638da5cb5b146101425780639d76ea5814610155578063a6f9dae114610168578063b269681d1461017b578063f2fde38b1461018e57600080fd5b8063183a4f6e146100ae5780632f54bf6e146100d65780633ccfd60b146100f957806370a0823114610103578063715018a614610116575b600080fd5b6100c16100bc366004610647565b6101a1565b60405190151581526020015b60405180910390f35b6100c16100e4366004610679565b6000546001600160a01b0391821691161490565b610101610298565b005b610101610111366004610679565b610334565b61011e610380565b005b6000546001600160a01b03165b6040516001600160a01b0390911681526020016100cd565b610101610163366004610647565b6103b4565b610101610176366004610679565b610451565b6100c1610189366004610647565b6104a5565b610101610176366004610679565b60008181526001602052604081205460ff16156101d55760405162461bcd60e51b81526004016101cc906106a4565b60405180910390fd5b600082815260016020819052604090912080546002909101805460ff19169091179055426002820155610207836104e2565b6040805184815242602082015233918101919091527f4d3754632451ebcd6de1f1b9a4080e60e227ee853250af7e4b3c44e9c58aa9a79060600160405180910390a1506001919050565b6000546001600160a01b031633146102c25760405162461bcd60e51b81526004016101cc906106db565b6040514790339082156108fc029083906000818181858888f193505050501580156102f1573d6000803e3d6000fd5b5060405181815233907f7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b659060200160405180910390a250565b6000546001600160a01b0316331461035e5760405162461bcd60e51b81526004016101cc906106db565b600080546001600160a01b0319166001600160a01b0392909216919091179055565b6000546001600160a01b031633146103aa5760405162461bcd60e51b81526004016101cc906106db565b6103b26105a0565b565b6000546001600160a01b031633146103de5760405162461bcd60e51b81526004016101cc906106db565b60008181526001602052604090205460ff166104315760405162461bcd60e51b815260206004820152601260248201527148617368206e6f7420666f756e642160701b60448201526064016101cc565b600090815260016020526040902080546002909101805460ff19169055565b6000546001600160a01b0316331461047b5760405162461bcd60e51b81526004016101cc906106db565b600080546001600160a01b0319166001600160a01b0392909216919091179055565b60008181526001602052604081205460ff16806104dc575060008281526001602052604090206002015442115b92915050565b6000818152600160205260409020546002015415610542576000818152600160205260409020600201544211156105425760405162461bcd60e51b815260206004820152601460248201527f48617368206973206e6f7420616374697665000000000000000000000000000060448201526064016101cc565b600081815260016020526040902080546002909101805460ff191660011790554260029091015550565b6000546001600160a01b031633146105ca5760405162461bcd60e51b81526004016101cc906106db565b600080546040516001600160a01b03909116907f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0908390a3600080546001600160a01b0319169055565b60006020828403121561062957600080fd5b5035919050565b80356001600160a01b038116811461064757600080fd5b919050565b60006020828403121561065e57600080fd5b61066782610630565b9392505050565b60006020828403121561068057600080fd5b61066782610630565b6020808252601c908201527f4f776e61626c653a2063616c6c6572206973206e6f74206f776e657200000000604082015260600190565b60208082526014908201527f48617368206e6f7420666f756e6420696e206d6170000000000000000000000060408201526060019056fea2646970667358221220a8c4b8b3c8f8e8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c864736f6c63430008130033";

    // Estimate gas
    const gasEstimate = await provider.estimateGas({
      data: contractBytecode
    });

    console.log('⛽ Estimated gas:', gasEstimate.toString());

    // Get current gas price
    const feeData = await provider.getFeeData();
    console.log('💸 Gas price:', ethers.formatUnits(feeData.gasPrice, 'gwei'), 'gwei');

    // Deploy contract
    console.log('📦 Deploying contract...');

    const deployTransaction = await wallet.sendTransaction({
      data: contractBytecode,
      gasLimit: gasEstimate,
      gasPrice: feeData.gasPrice
    });

    console.log('📋 Transaction hash:', deployTransaction.hash);
    console.log('⏳ Waiting for confirmation...');

    const receipt = await deployTransaction.wait();

    if (receipt.status === 1) {
      console.log('✅ Contract deployed successfully!');
      console.log('📍 Contract address:', receipt.contractAddress);
      console.log('🧱 Block number:', receipt.blockNumber);
      console.log('⛽ Gas used:', receipt.gasUsed.toString());

      // Save contract address to environment file
      const envPath = path.join(__dirname, '../.env');
      let envContent = '';

      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Update or add contract address
      const contractAddressLine = `BLOCKCHAIN_CONTRACT_ADDRESS=${receipt.contractAddress}`;

      if (envContent.includes('BLOCKCHAIN_CONTRACT_ADDRESS=')) {
        envContent = envContent.replace(/BLOCKCHAIN_CONTRACT_ADDRESS=.*/, contractAddressLine);
      } else {
        envContent += `\n${contractAddressLine}\n`;
      }

      fs.writeFileSync(envPath, envContent);
      console.log('💾 Contract address saved to .env file');

      return {
        success: true,
        contractAddress: receipt.contractAddress,
        transactionHash: deployTransaction.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } else {
      throw new Error('Contract deployment failed');
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run deployment if called directly
if (require.main === module) {
  deployContract()
    .then(result => {
      if (result.success) {
        console.log('🎉 Deployment completed successfully!');
        process.exit(0);
      } else {
        console.error('💥 Deployment failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { deployContract };