'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';

export default function BelvoSettings() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // Estados do formulário
  const [secretId, setSecretId] = useState('');
  const [secretPassword, setSecretPassword] = useState('');
  const [environment, setEnvironment] = useState('sandbox');

  // Carregar configurações ao abrir
  useEffect(() => {
    loadConfig();
    // Carregar script da Belvo
    const script = document.createElement('script');
    script.src = 'https://cdn.belvo.io/belvo-widget-1-stable.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    }
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca a organização do usuário (supondo que está na tabela usuarios ou metadados)
      // Aqui vamos buscar direto na tabela configuracoes_belvo usando a política de segurança RLS
      const { data, error } = await supabase
        .from('configuracoes_belvo')
        .select('*')
        .maybeSingle();

      if (data) {
        setSecretId(data.secret_id || '');
        setSecretPassword(data.secret_password || '');
        setEnvironment(data.environment || 'sandbox');
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg({ type: '', text: '' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Descobrir ID da organização (Helper simples baseado no usuário)
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();
        
      if (!usuario?.organizacao_id) throw new Error('Organização não encontrada');

      // 2. Salvar/Atualizar
      const { error } = await supabase
        .from('configuracoes_belvo')
        .upsert({ 
          organizacao_id: usuario.organizacao_id,
          secret_id: secretId,
          secret_password: secretPassword,
          environment: environment,
          updated_at: new Date()
        }, { onConflict: 'organizacao_id' });

      if (error) throw error;

      setMsg({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error(error);
      setMsg({ type: 'error', text: 'Erro ao salvar: ' + error.message });
    } finally {
      setSaving(false);
    }
  }

  // Função para abrir o Widget da Belvo e conectar um banco
  async function handleConnectBank() {
    setMsg({ type: 'info', text: 'Iniciando conexão...' });
    
    try {
      // 1. Pedir Token para nossa API
      const response = await fetch('/api/belvo/token', { method: 'POST' });
      const data = await response.json();

      if (!data.access) throw new Error('Falha ao obter token da Belvo');

      // 2. Abrir o Widget
      // @ts-ignore
      if (typeof window.belvoSDK === 'undefined') {
        throw new Error('Script da Belvo ainda não carregou. Tente novamente em alguns segundos.');
      }

      window.belvoSDK.createWidget(data.access, {
        locale: 'pt',
        country_codes: ['BR'],
        callback: (link, institution) => {
          // SUCESSO! O usuário conectou o banco.
          // link: ID da conexão
          // institution: Dados do banco
          console.log('Conexão realizada:', link, institution);
          alert(`Sucesso! Banco ${institution.name} conectado. ID: ${link}`);
          // AQUI FUTURAMENTE VAMOS SALVAR O ID NO BANCO DE DADOS
        },
        onExit: (data) => {
          console.log('Usuário fechou o widget', data);
        },
        onEvent: (data) => {
          console.log('Evento Belvo:', data);
        }
      }).build();

    } catch (error) {
      console.error(error);
      setMsg({ type: 'error', text: 'Erro ao conectar: ' + error.message });
    }
  }

  if (loading) return <CircularProgress />;

  return (
    <Card sx={{ maxWidth: 800, mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Configuração Open Finance (Belvo)</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Insira as chaves de API obtidas no painel da Belvo para habilitar a conciliação automática.
        </Typography>

        {msg.text && (
          <Alert severity={msg.type === 'error' ? 'error' : msg.type === 'success' ? 'success' : 'info'} sx={{ mb: 2 }}>
            {msg.text}
          </Alert>
        )}

        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Ambiente</InputLabel>
            <Select
              value={environment}
              label="Ambiente"
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <MenuItem value="sandbox">Sandbox (Teste - Dados Fictícios)</MenuItem>
              <MenuItem value="development">Development (Teste - Dados Reais)</MenuItem>
              <MenuItem value="production">Produção (Valendo)</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Secret ID"
            value={secretId}
            onChange={(e) => setSecretId(e.target.value)}
            fullWidth
            size="small"
            type="password"
          />

          <TextField
            label="Secret Password"
            value={secretPassword}
            onChange={(e) => setSecretPassword(e.target.value)}
            fullWidth
            size="small"
            type="password"
          />

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>

            <Button 
              variant="outlined" 
              color="secondary"
              onClick={handleConnectBank}
              disabled={!secretId || !secretPassword}
            >
              Testar Conexão (Abrir Widget)
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}