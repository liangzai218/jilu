import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { User, Cloud, Download, Upload, AlertTriangle, Check, X, Copy, Trash2, Image as ImageIcon, LogIn, LogOut, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

// 导入 Convex
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface SettingsProps {
  autoSync: boolean;
  updateSettings: (settings: { autoSync: boolean }) => void;
  exportData: () => string;
  importData: (data: string) => boolean;
  clearAllData: () => void;
}

// 模拟Convex同步状态
interface SyncState {
  isLoggedIn: boolean;
  username: string | null;
  lastSyncTime: string | null;
  isSyncing: boolean;
}
export default function Settings({ autoSync, updateSettings, exportData, importData, clearAllData }: SettingsProps) {
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [scanError, setScanError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('export');
  const [scanActiveTab, setScanActiveTab] = useState('camera');
  
  // 云端同步状态
  const [syncState, setSyncState] = useState<SyncState>({
    isLoggedIn: false,
    username: null,
    lastSyncTime: null,
    isSyncing: false
  });
  
  // 登录/注册表单
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 获取 Convex 客户端
  const convex = useConvex();
  // 从本地存储加载登录状态
  useEffect(() => {
    const savedSyncState = localStorage.getItem('jilu_sync_state');
    if (savedSyncState) {
      setSyncState(JSON.parse(savedSyncState));
    }
  }, []);

  // 保存同步状态
  const saveSyncState = (newState: SyncState) => {
    setSyncState(newState);
    localStorage.setItem('jilu_sync_state', JSON.stringify(newState));
  };

  // 生成二维码
  const generateQR = async () => {
    const data = exportData();
    const maxLength = 2000;
    if (data.length > maxLength) {
      setScanError('数据量较大，建议分批导出或使用文本方式');
      return;
    }
    try {
      const url = await QRCode.toDataURL(data, { width: 300, margin: 2 });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  };

  // 开始扫描
  const startScan = async () => {
    setScanResult('');
    setScanError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanFrame();
      }
    } catch (err) {
      setScanError('无法访问摄像头，请确保已授予权限');
      console.error('Camera access failed:', err);
    }
  };
  // 停止扫描
  const stopScan = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // 扫描帧
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      setScanResult(code.data);
      stopScan();
      return;
    }
    requestAnimationFrame(scanFrame);
  };

  // 处理图片文件扫描
  const handleImageScan = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          setScanResult(code.data);
          setScanError('');
        } else {
          setScanError('未能识别二维码，请尝试其他图片');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  // 处理导入
  const handleImport = () => {
    if (scanResult) {
      const success = importData(scanResult);
      if (success) {
        setImportSuccess(true);
        setTimeout(() => {
          setImportSuccess(false);
          setShowScanDialog(false);
          setScanResult('');
        }, 2000);
      } else {
        setScanError('导入失败，数据格式可能不正确');
      }
    }
  };

  // 文本导入
  const [textImport, setTextImport] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTextImport = () => {
    if (textImport.trim()) {
      const success = importData(textImport.trim());
      if (success) {
        setImportSuccess(true);
        setTextImport('');
        setTimeout(() => {
          setImportSuccess(false);
          setShowScanDialog(false);
        }, 2000);
      } else {
        setScanError('导入失败，数据格式可能不正确');
      }
    }
  };
  // 真实的 Convex 登录处理
  const handleLogin = async () => {
    setAuthError('');
    
    if (!username || !password) {
      setAuthError('请填写用户名和密码');
      return;
    }
    
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    
    try {
      // 调用 Convex 登录 API
      const result = await convex.query(api.auth.login, { username, password });
      // 或者使用 mutation 钩子：
      // const result = await loginMutation({ username, password });
      
      if (result.success) {
        // 登录成功
        const newState: SyncState = {
          isLoggedIn: true,
          username: username,
          lastSyncTime: new Date().toISOString(),
          isSyncing: false
        };
        
        saveSyncState(newState);
        setShowLoginDialog(false);
        setUsername('');
        setPassword('');
        
        // 如果开启了自动同步，触发一次同步
        if (autoSync) {
          triggerSync();
        }
      } else {
        throw new Error('登录失败，请检查用户名和密码');
      }
    } catch (err: any) {
      console.error('登录失败:', err);
      setAuthError(err.message || '登录失败，请检查用户名和密码');
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  };

  // 真实的 Convex 注册处理
  const handleRegister = async () => {
    setAuthError('');
    
    if (!username || !password) {
      setAuthError('请填写用户名和密码');
      return;
    }
    
    if (password !== confirmPassword) {
      setAuthError('两次输入的密码不一致');
      return;
    }
    
    if (password.length < 6) {
      setAuthError('密码长度至少6位');
      return;
    }
    
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    
    try {
      // 调用 Convex 注册 API
      const result = await convex.mutation(api.auth.register, { username, password });
      // 或者使用 mutation 钩子：
      // const result = await registerMutation({ username, password });
      
      if (result.success) {
        // 注册成功，自动登录
        const newState: SyncState = {
          isLoggedIn: true,
          username: username,
          lastSyncTime: new Date().toISOString(),
          isSyncing: false
        };
        
        saveSyncState(newState);
        setShowRegisterDialog(false);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setAuthError('');
        
        // 显示成功消息
        setTimeout(() => {
          alert('注册成功！已自动登录。');
        }, 100);
        
        // 如果开启了自动同步，触发一次同步
        if (autoSync) {
          triggerSync();
        }
      } else {
        throw new Error('注册失败，请稍后重试');
      }
    } catch (err: any) {
      console.error('注册失败:', err);
      setAuthError(err.message || '注册失败，该用户名可能已存在');
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  };
  // 退出登录
  const handleLogout = () => {
    const newState: SyncState = {
      isLoggedIn: false,
      username: null,
      lastSyncTime: null,
      isSyncing: false
    };
    saveSyncState(newState);
  };

  // 手动同步（需要实现真实的同步逻辑）
  const triggerSync = async () => {
    if (!syncState.isLoggedIn) return;
    
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    
    try {
      // 这里需要实现真实的数据同步逻辑
      // 例如：获取本地数据，调用 Convex 同步 API
      // const data = exportData();
      // await convex.mutation(api.data.sync, { data });
      
      // 模拟同步过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      saveSyncState({
        ...syncState,
        lastSyncTime: new Date().toISOString(),
        isSyncing: false
      });
      
      console.log('同步成功');
    } catch (err) {
      console.error('同步失败:', err);
      saveSyncState({
        ...syncState,
        isSyncing: false
      });
    }
  };

  useEffect(() => {
    return () => { stopScan(); };
  }, []);

  // 格式化同步时间
  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return '从未同步';
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-slate-100 p-4 pb-24 overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
        <User className="w-6 h-6 mr-2 text-gray-600" />我的
      </h1>

      {/* 云端同步卡片 */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <Cloud className="w-5 h-5 mr-2 text-blue-500" />
            云端同步
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {syncState.isLoggedIn ? (
            // 已登录状态
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{syncState.username}</p>
                  <p className="text-sm text-gray-500">
                    上次同步: {formatSyncTime(syncState.lastSyncTime)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={triggerSync}
                    disabled={syncState.isSyncing}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      syncState.isSyncing 
                        ? 'bg-blue-100 text-blue-500' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <RefreshCw className={`w-5 h-5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-10 h-10 rounded-full bg-red-100 text-red-500 hover:bg-red-200 flex items-center justify-center"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="font-medium text-gray-800">自动同步</p>
                  <p className="text-sm text-gray-500">数据变更时自动备份到云端</p>
                </div>
                <Switch 
                  checked={autoSync} 
                  onCheckedChange={(checked) => updateSettings({ autoSync: checked })} 
                />
              </div>
            </>
          ) : (
            // 未登录状态
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">本地存储模式</p>
                  <p className="text-sm text-gray-500">数据仅保存在本设备</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowLoginDialog(true)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  登录
                </Button>
                <Button 
                  onClick={() => setShowRegisterDialog(true)}
                  variant="outline"
                  className="flex-1"
                >
                  注册
                </Button>
              </div>
              
              <div className="p-3 bg-yellow-50 rounded-lg flex items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700">
                  当前为本地存储模式，建议定期导出备份或登录账号启用云端同步
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 数据管理卡片 */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">数据管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => { setActiveTab('export'); generateQR(); setShowQRDialog(true); }}
          >
            <Download className="w-5 h-5 mr-3 text-green-500" />导出数据
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              setScanActiveTab('camera');
              setScanResult('');
              setScanError('');
              setShowScanDialog(true);
              setTimeout(() => startScan(), 100);
            }}
          >
            <Upload className="w-5 h-5 mr-3 text-blue-500" />导入数据
          </Button>
          <div className="border-t pt-3 mt-3">
            <Button
              variant="outline"
              className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="w-5 h-5 mr-3" />清除所有数据
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 关于 */}
      <div className="mt-auto pt-8 text-center">
        <div className="flex justify-center mb-3">
          <img src="/app-icon.png" alt="迹录" className="w-16 h-16 rounded-2xl shadow-lg" />
        </div>
        <p className="text-sm text-gray-400">迹录 v3.0</p>
        <p className="text-xs text-gray-300 mt-1">记录生活的点滴</p>
      </div>
      {/* 登录对话框 - 更新登录按钮状态 */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>登录账号</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Cloud className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-sm text-gray-600">登录后数据将自动备份到云端</p>
            </div>
            
            <div>
              <label className="text-sm text-gray-600 mb-1 block">用户名</label>
              <Input
                type="text"
                placeholder="输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={syncState.isSyncing}
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-600 mb-1 block">密码</label>
              <Input
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={syncState.isSyncing}
              />
            </div>
            
            {authError && (
              <p className="text-sm text-red-500">{authError}</p>
            )}
            
            <Button 
              onClick={handleLogin} 
              className="w-full bg-blue-500 hover:bg-blue-600"
              disabled={syncState.isSyncing || !username || !password}
            >
              {syncState.isSyncing ? '登录中...' : '登录'}
            </Button>
            
            <p className="text-xs text-gray-400 text-center">
              连接到 Convex 后端进行身份验证
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 注册对话框 - 更新注册按钮状态 */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>注册账号</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">用户名</label>
              <Input
                type="text"
                placeholder="设置用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={syncState.isSyncing}
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-600 mb-1 block">密码</label>
              <Input
                type="password"
                placeholder="设置密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={syncState.isSyncing}
              />
            </div>
            
            <div>
              <label className="text-sm text-gray-600 mb-1 block">确认密码</label>
              <Input
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={syncState.isSyncing}
              />
            </div>
            
            {authError && (
              <p className="text-sm text-red-500">{authError}</p>
            )}
            
            <Button 
              onClick={handleRegister} 
              className="w-full bg-blue-500 hover:bg-blue-600"
              disabled={syncState.isSyncing || !username || !password || !confirmPassword || password.length < 6}
            >
              {syncState.isSyncing ? '注册中...' : '注册'}
            </Button>
            
            <p className="text-xs text-gray-400 text-center">
              连接到 Convex 后端创建新账号
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 导出二维码对话框 */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>导出数据</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="export">二维码</TabsTrigger>
                <TabsTrigger value="text">文本</TabsTrigger>
              </TabsList>
              <TabsContent value="export" className="text-center">
                {qrDataUrl ? (
                  <div className="space-y-3">
                    <img src={qrDataUrl} alt="QR Code" className="mx-auto" />
                    <p className="text-sm text-gray-500">使用另一台设备扫描此二维码即可导入数据</p>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-gray-500">数据量较大，请使用文本方式导出</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="text">
                <div className="space-y-3">
                  <textarea
                    readOnly
                    value={exportData()}
                    className="w-full h-40 p-3 text-xs bg-gray-50 rounded-lg border resize-none font-mono"
                  />
                  <p className="text-sm text-gray-500">复制以上文本，在另一设备粘贴导入</p>
                  <Button onClick={() => handleCopy(exportData())} className="w-full" variant="outline">
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}复制文本
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={showScanDialog} onOpenChange={(open) => {
        if (!open) stopScan();
        setShowScanDialog(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>导入数据</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Tabs value={scanActiveTab} onValueChange={(v) => {
              setScanActiveTab(v);
              if (v === 'camera') setTimeout(() => startScan(), 100);
              else stopScan();
            }}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="camera">扫码</TabsTrigger>
                <TabsTrigger value="album">相册</TabsTrigger>
                <TabsTrigger value="text">文本</TabsTrigger>
              </TabsList>
              
              <TabsContent value="camera">
                {!scanResult ? (
                  <div className="space-y-3">
                    <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '250px' }}>
                      <video ref={videoRef} className="w-full h-full object-cover" playsInline />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 border-2 border-white/30 rounded-lg">
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-green-400/50 rounded-lg">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400" />
                        </div>
                      </div>
                    </div>
                    {scanError && <p className="text-sm text-red-500 text-center">{scanError}</p>}
                    <p className="text-sm text-gray-500 text-center">将二维码放入框内扫描</p>
                  </div>
                ) : (
                  <ImportConfirm onCancel={() => { setScanResult(''); startScan(); }} onConfirm={handleImport} importSuccess={importSuccess} />
                )}
              </TabsContent>
              
              <TabsContent value="album">
                {!scanResult ? (
                  <div className="space-y-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageScan}
                      className="hidden"
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">点击选择图片</p>
                      <p className="text-sm text-gray-400 mt-1">支持包含二维码的图片</p>
                    </div>
                    {scanError && <p className="text-sm text-red-500 text-center">{scanError}</p>}
                  </div>
                ) : (
                  <ImportConfirm onCancel={() => setScanResult('')} onConfirm={handleImport} importSuccess={importSuccess} />
                )}
              </TabsContent>
              
              <TabsContent value="text">
                <div className="space-y-3">
                  <textarea
                    placeholder="粘贴导出的数据文本..."
                    value={textImport}
                    onChange={(e) => setTextImport(e.target.value)}
                    className="w-full h-40 p-3 text-xs bg-gray-50 rounded-lg border resize-none font-mono"
                  />
                  {scanError && <p className="text-sm text-red-500">{scanError}</p>}
                  {importSuccess ? (
                    <div className="text-center py-4">
                      <Check className="w-8 h-8 text-green-500 mx-auto" />
                      <p className="text-green-600">导入成功！</p>
                    </div>
                  ) : (
                    <Button onClick={handleTextImport} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!textImport.trim()}>
                      <Upload className="w-4 h-4 mr-2" />导入
                    </Button>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* 清除数据对话框 */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>清除所有数据</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {clearSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-lg font-semibold text-green-600">数据已清除！</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-center text-red-700">此操作将删除所有数据，且无法恢复！</p>
                </div>
                <p className="text-sm text-gray-500 text-center">建议先导出备份数据</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowClearDialog(false)} className="flex-1">取消</Button>
                  <Button
                    onClick={() => { clearAllData(); setClearSuccess(true); setTimeout(() => { setClearSuccess(false); setShowClearDialog(false); }, 2000); }}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />确认清除
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// 导入确认组件
function ImportConfirm({ onCancel, onConfirm, importSuccess }: { 
  onCancel: () => void; 
  onConfirm: () => void;
  importSuccess: boolean;
}) {
  return (
    <div className="text-center space-y-4">
      {importSuccess ? (
        <div className="py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-lg font-semibold text-green-600">导入成功！</p>
        </div>
      ) : (
        <>
          <p className="text-gray-600">检测到数据，是否导入？</p>
          <p className="text-xs text-gray-400">这将覆盖当前所有数据</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              <X className="w-4 h-4 mr-1" />取消
            </Button>
            <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-1" />确认导入
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
