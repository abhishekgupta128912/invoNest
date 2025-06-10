import { ethers } from 'ethers';
import crypto from 'crypto';

// Simple smart contract ABI for invoice verification
const INVOICE_VERIFIER_ABI = [
  {
    "inputs": [
      {"internalType": "string", "name": "_invoiceHash", "type": "string"},
      {"internalType": "string", "name": "_metadata", "type": "string"}
    ],
    "name": "storeInvoiceHash",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "_invoiceHash", "type": "string"}],
    "name": "verifyInvoiceHash",
    "outputs": [
      {"internalType": "bool", "name": "exists", "type": "bool"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "string", "name": "metadata", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "string", "name": "", "type": "string"}],
    "name": "invoiceHashes",
    "outputs": [
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "string", "name": "metadata", "type": "string"},
      {"internalType": "bool", "name": "exists", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Contract address on Polygon Mumbai testnet (this would be deployed separately)
const CONTRACT_ADDRESS = process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;

  constructor() {
    // Initialize provider for Polygon Mumbai testnet
    const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Initialize wallet
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.warn('PRIVATE_KEY not found in environment variables. Blockchain features will be disabled.');
      return;
    }

    this.wallet = new ethers.Wallet(privateKey, this.provider);

    // Initialize contract
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, INVOICE_VERIFIER_ABI, this.wallet);
  }

  /**
   * Generate a hash for invoice data
   */
  generateInvoiceHash(invoiceData: any): string {
    const dataString = JSON.stringify({
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceDate: invoiceData.invoiceDate,
      customerId: invoiceData.customer?.email || invoiceData.customer?.name,
      grandTotal: invoiceData.grandTotal,
      items: invoiceData.items?.map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount
      }))
    });

    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Store invoice hash on blockchain
   */
  async storeInvoiceHash(invoiceHash: string, metadata: string): Promise<{
    success: boolean;
    transactionHash?: string;
    blockNumber?: number;
    error?: string;
  }> {
    try {
      if (!this.contract) {
        return {
          success: false,
          error: 'Blockchain service not initialized'
        };
      }

      // Check if hash already exists
      const existingRecord = await this.contract.invoiceHashes(invoiceHash);
      if (existingRecord.exists) {
        return {
          success: false,
          error: 'Invoice hash already exists on blockchain'
        };
      }

      // Store the hash on blockchain
      const transaction = await this.contract.storeInvoiceHash(invoiceHash, metadata);
      const receipt = await transaction.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error('Blockchain storage error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error'
      };
    }
  }

  /**
   * Verify invoice hash on blockchain
   */
  async verifyInvoiceHash(invoiceHash: string): Promise<{
    success: boolean;
    exists: boolean;
    timestamp?: number;
    metadata?: string;
    error?: string;
  }> {
    try {
      if (!this.contract) {
        return {
          success: false,
          exists: false,
          error: 'Blockchain service not initialized'
        };
      }

      const result = await this.contract.verifyInvoiceHash(invoiceHash);

      return {
        success: true,
        exists: result.exists,
        timestamp: result.exists ? Number(result.timestamp) : undefined,
        metadata: result.exists ? result.metadata : undefined
      };

    } catch (error) {
      console.error('Blockchain verification error:', error);
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error'
      };
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    success: boolean;
    network?: any;
    blockNumber?: number;
    gasPrice?: string;
    error?: string;
  }> {
    try {
      if (!this.provider) {
        return {
          success: false,
          error: 'Provider not initialized'
        };
      }

      const [network, blockNumber, gasPrice] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber(),
        this.provider.getFeeData()
      ]);

      return {
        success: true,
        network: {
          name: network.name,
          chainId: Number(network.chainId)
        },
        blockNumber,
        gasPrice: gasPrice.gasPrice?.toString()
      };

    } catch (error) {
      console.error('Network info error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown network error'
      };
    }
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(): Promise<{
    success: boolean;
    balance?: string;
    balanceInMatic?: string;
    error?: string;
  }> {
    try {
      if (!this.wallet) {
        return {
          success: false,
          error: 'Wallet not initialized'
        };
      }

      const balance = await this.wallet.provider?.getBalance(this.wallet.address);
      
      if (!balance) {
        return {
          success: false,
          error: 'Could not fetch balance'
        };
      }

      return {
        success: true,
        balance: balance.toString(),
        balanceInMatic: ethers.formatEther(balance)
      };

    } catch (error) {
      console.error('Balance check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown balance error'
      };
    }
  }

  /**
   * Check if blockchain service is available
   */
  isAvailable(): boolean {
    return !!(this.provider && this.wallet && this.contract && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000');
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{
    available: boolean;
    network?: any;
    balance?: string;
    contractAddress?: string;
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return {
        available: false,
        error: 'Blockchain service not properly configured'
      };
    }

    try {
      const [networkInfo, balanceInfo] = await Promise.all([
        this.getNetworkInfo(),
        this.getWalletBalance()
      ]);

      return {
        available: true,
        network: networkInfo.network,
        balance: balanceInfo.balanceInMatic,
        contractAddress: CONTRACT_ADDRESS
      };

    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Service status check failed'
      };
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
