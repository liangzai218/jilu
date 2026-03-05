import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Eye, EyeOff, FileText, Lock, Copy, Check } from 'lucide-react';
import type { Note } from '@/types';

interface NotesProps {
  notes: Note[];
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
}

export default function Notes({ notes, addNote, updateNote, deleteNote }: NotesProps) {
  const [activeTab, setActiveTab] = useState('text');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // 表单状态
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');

  const resetForm = () => {
    setTitle('');
    setContent('');
    setAccount('');
    setPassword('');
    setEditingNote(null);
    setShowPassword(false);
  };

  const handleAdd = () => {
    if (title.trim()) {
      if (activeTab === 'text') {
        addNote({
          title: title.trim(),
          content: content.trim(),
          type: 'text',
        });
      } else {
        addNote({
          title: title.trim(),
          content: '',
          type: 'password',
          account: account.trim(),
          password: password,
        });
      }
      resetForm();
      setShowAddDialog(false);
    }
  };

  const handleUpdate = () => {
    if (editingNote && title.trim()) {
      const updates: Partial<Note> = {
        title: title.trim(),
      };
      if (editingNote.type === 'text') {
        updates.content = content.trim();
      } else {
        updates.account = account.trim();
        updates.password = password;
      }
      updateNote(editingNote.id, updates);
      resetForm();
      setShowAddDialog(false);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setAccount(note.account || '');
    setPassword(note.password || '');
    setActiveTab(note.type);
    setShowAddDialog(true);
  };

  const handleView = (note: Note) => {
    setViewingNote(note);
    setShowPassword(false);
    setShowViewDialog(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const textNotes = notes.filter(n => n.type === 'text').sort((a, b) => b.updatedAt - a.updatedAt);
  const passwordNotes = notes.filter(n => n.type === 'password').sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-purple-50 to-indigo-50 p-4 pb-24 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FileText className="w-6 h-6 mr-2 text-purple-600" />
          记事本
        </h1>
        <Button
          onClick={() => {
            resetForm();
            setShowAddDialog(true);
          }}
          className="bg-purple-600 hover:bg-purple-700"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="text" className="flex items-center">
            <FileText className="w-4 h-4 mr-1" />
            文字笔记
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center">
            <Lock className="w-4 h-4 mr-1" />
            密码记录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-3">
          {textNotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-purple-200 mx-auto mb-4" />
              <p className="text-gray-500">还没有文字笔记</p>
              <Button
                onClick={() => {
                  resetForm();
                  setShowAddDialog(true);
                }}
                variant="outline"
                className="mt-4"
              >
                添加第一条笔记
              </Button>
            </div>
          ) : (
            textNotes.map(note => (
              <Card
                key={note.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleView(note)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 mb-1">{note.title}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2">{note.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(note.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(note);
                        }}
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="password" className="space-y-3">
          {passwordNotes.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="w-16 h-16 text-purple-200 mx-auto mb-4" />
              <p className="text-gray-500">还没有密码记录</p>
              <Button
                onClick={() => {
                  resetForm();
                  setActiveTab('password');
                  setShowAddDialog(true);
                }}
                variant="outline"
                className="mt-4"
              >
                添加第一条密码
              </Button>
            </div>
          ) : (
            passwordNotes.map(note => (
              <Card
                key={note.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleView(note)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">{note.title}</h3>
                      <p className="text-sm text-gray-500">{note.account || '无账号'}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(note);
                        }}
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* 添加/编辑对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingNote ? '编辑' : '新建'}
              {activeTab === 'text' ? '文字笔记' : '密码记录'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {activeTab === 'text' ? (
              <Textarea
                placeholder="内容"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
              />
            ) : (
              <>
                <Input
                  placeholder="账号/用户名"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={editingNote ? handleUpdate : handleAdd}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={!title.trim()}
              >
                {editingNote ? '保存' : '添加'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 查看对话框 */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{viewingNote?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {viewingNote?.type === 'text' ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-wrap">{viewingNote.content}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {viewingNote?.account && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500 mb-1">账号</p>
                    <div className="flex items-center justify-between">
                      <p className="text-gray-800 font-mono">{viewingNote.account}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(viewingNote.account || '')}
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}
                {viewingNote?.password && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500 mb-1">密码</p>
                    <div className="flex items-center justify-between">
                      <p className="text-gray-800 font-mono">
                        {showPassword ? viewingNote.password : '••••••••'}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(viewingNote.password || '')}
                        >
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">
              最后更新: {viewingNote && new Date(viewingNote.updatedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
