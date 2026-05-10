export const store = {
    user: null,
    isAdmin: false,
    data: [],
    storageBucket: 'covers',
    currentView: 'dashboard',
    
    // Cache & Temp states
    adminCache: [],
    adminCatalogCache: [],
    scannedBookCache: null,
    codeReader: null,
    scannerStream: null,
    aiScanImageDataUrl: null,
    loadingScripts: {},
    pendingRejectedIds: JSON.parse(localStorage.getItem('manga_pending_rejected_ids') || '[]'),
    userSeriesSettings: {},
    viewMode: localStorage.getItem('viewMode') || 'grid',
    seriesMetadata: {},
    currentSeries: null,
    syncQueue: JSON.parse(localStorage.getItem('manga_sync_queue') || '[]'),
    isSyncing: false,
    settings: {
        gridCols: localStorage.getItem('gridCols') || localStorage.getItem('setting_gridCols') || '6',
        fontSize: localStorage.getItem('fontSize') || localStorage.getItem('setting_fontSize') || 'normal'
    }
};
