import React, { useState, useRef } from 'react';
import { auth, getFirebaseStorage } from '../firebase';
import { supabase } from '../lib/supabaseClient';
import { 
  updateEmail, 
  updatePassword, 
  updateProfile, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  verifyBeforeUpdateEmail
} from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Lock, 
  Camera, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';

interface UserSettingsProps {
  user: any;
}

export const UserSettings: React.FC<UserSettingsProps> = ({ user }) => {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(user?.photoURL || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email !== confirmEmail) {
      setError('Os e-mails não coincidem.');
      return;
    }
    
    setLoading('email');
    setError(null);
    setSuccess(null);
    
    try {
      if (auth.currentUser) {
        await verifyBeforeUpdateEmail(auth.currentUser, email);
        setSuccess('Um e-mail de verificação foi enviado para o novo endereço. Após confirmar, o e-mail será atualizado.');
        setEmail('');
        setConfirmEmail('');
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Esta operação requer um login recente. Por favor, saia e entre novamente.');
      } else {
        setError(err.message || 'Erro ao atualizar e-mail.');
      }
    } finally {
      setLoading(null);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError('As novas senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    
    setLoading('password');
    setError(null);
    setSuccess(null);
    
    try {
      const user = auth.currentUser;
      if (user && user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        setSuccess('Senha atualizada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha. Verifique sua senha atual.');
    } finally {
      setLoading(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('A imagem deve ter no máximo 2MB.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoUpload = async () => {
    if (!selectedFile || !auth.currentUser) return;
    
    setLoading('photo');
    setError(null);
    setSuccess(null);
    
    const storage = getFirebaseStorage();
    
    if (storage) {
      // Try Firebase Storage
      const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);
      
      uploadTask.on(
        'state_changed',
        null,
        (err) => {
          console.error('Firebase Storage upload error:', err);
          trySupabaseUpload();
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateProfile(auth.currentUser!, { photoURL: downloadURL });
          setSuccess('Foto de perfil atualizada via Firebase!');
          setSelectedFile(null);
          setLoading(null);
        }
      );
    } else {
      // Fallback to Supabase Storage
      trySupabaseUpload();
    }
  };

  const trySupabaseUpload = async () => {
    if (!selectedFile || !auth.currentUser) return;
    
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${auth.currentUser.uid}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase 'avatars' bucket
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfile(auth.currentUser!, { photoURL: publicUrl });
      setSuccess('Foto de perfil atualizada via Supabase!');
      setSelectedFile(null);
    } catch (err: any) {
      console.error('Supabase Storage error:', err);
      setError('Erro ao fazer upload da imagem. Certifique-se de que o bucket "avatars" existe no Supabase.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configurações</h2>
          <p className="text-zinc-500 text-sm">Gerencie sua conta e preferências de segurança.</p>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm"
        >
          <AlertCircle size={18} />
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-sm"
        >
          <CheckCircle2 size={18} />
          {success}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Perfil */}
        <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <User size={20} className="text-emerald-500" />
            </div>
            <h3 className="font-bold text-lg">Perfil</h3>
          </div>

          <div className="flex flex-col items-center gap-6 py-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full border-4 border-zinc-800 overflow-hidden bg-zinc-900">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700">
                    <User size={48} />
                  </div>
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-emerald-500 rounded-full text-white shadow-lg hover:bg-emerald-600 transition-colors"
              >
                <Camera size={18} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg" 
                onChange={handleFileSelect}
              />
            </div>
            
            <div className="text-center">
              <p className="text-sm font-medium">{user?.displayName || 'Usuário'}</p>
              <p className="text-xs text-zinc-500">{user?.email}</p>
            </div>

            {selectedFile && (
              <button
                onClick={handlePhotoUpload}
                disabled={loading === 'photo'}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'photo' ? <Loader2 className="animate-spin" size={18} /> : 'Salvar nova foto'}
              </button>
            )}
          </div>
        </div>

        {/* Dados do Usuário */}
        <div className="bg-[#111111] border border-zinc-800/50 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Mail size={20} className="text-blue-500" />
            </div>
            <h3 className="font-bold text-lg">Dados do Usuário</h3>
          </div>

          <form onSubmit={handleEmailUpdate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Novo E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="novo@email.com"
                  className="w-full bg-[#161616] border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Confirmar E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Confirme o novo e-mail"
                  className="w-full bg-[#161616] border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading === 'email'}
              className="w-full py-3 bg-zinc-800 text-white rounded-xl font-bold text-sm hover:bg-zinc-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'email' ? <Loader2 className="animate-spin" size={18} /> : 'Salvar novo e-mail'}
            </button>
          </form>
        </div>

        {/* Segurança */}
        <div className="md:col-span-2 bg-[#111111] border border-zinc-800/50 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ShieldCheck size={20} className="text-red-500" />
            </div>
            <h3 className="font-bold text-lg">Segurança</h3>
          </div>

          <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Senha Atual</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Sua senha atual"
                    className="w-full bg-[#161616] border border-zinc-800 rounded-xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:border-emerald-500 transition-all"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-[#161616] border border-zinc-800 rounded-xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:border-emerald-500 transition-all"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Confirmar Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    className="w-full bg-[#161616] border border-zinc-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading === 'password'}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === 'password' ? <Loader2 className="animate-spin" size={18} /> : 'Atualizar senha'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
