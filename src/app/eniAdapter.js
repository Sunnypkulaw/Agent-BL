// ENI Adapter for eBL document ingestion
// Provides mock ENI interface when live ENI is unavailable

import crypto from 'node:crypto';

export class ENIAdapter {
  constructor(mode = 'mock') {
    this.mode = mode; // 'live' or 'mock'
  }

  async uploadDocument(file) {
    if (this.mode === 'live') {
      return this._uploadToENI(file);
    }
    return this._mockUpload(file);
  }

  async _uploadToENI(file) {
    // Real ENI integration would go here
    throw new Error('Live ENI not available - falling back to mock');
  }

  _mockUpload(file) {
    const { name, type, size, content } = file;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(type)) {
      throw new Error(`Invalid file type: ${type}. Allowed: ${allowedTypes.join(', ')}`);
    }

    // Validate file size (10MB limit)
    if (size > 10 * 1024 * 1024) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Generate document hash
    const hash = crypto.createHash('sha256')
      .update(content || name + Date.now())
      .digest('hex');

    return {
      documentId: `ENI-DOC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentHash: hash,
      fileName: name,
      fileType: type,
      fileSize: size,
      uploadedAt: new Date().toISOString(),
      status: 'verified',
      eniNetwork: 'injective_testnet_mock'
    };
  }

  async getDocumentStatus(documentId) {
    return {
      documentId,
      status: 'verified',
      verifiedAt: new Date().toISOString()
    };
  }
}

export const eniAdapter = new ENIAdapter('mock');
