'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Typography,
  Grid,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

export default function EmpreendimentoForm({ empreendimento, corporateEntities = [] }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'lancamento',
    address_zip_code: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'Brasil',
    total_area: '',
    private_area: '',
    suites: '',
    bedrooms: '',
    bathrooms: '',
    garages: '',
    delivery_date: '',
    price: '',
    incorporadora_id: null, // Novo campo para ID da incorporadora
    construtora_id: null,  // Novo campo para ID da construtora
    incorporadora_nome: '', // Mantido para exibição do nome
    construtora_nome: '',   // Mantido para exibição do nome
    company_proprietaria_id: null, // ID da empresa proprietária
    company_proprietaria_name: '', // Nome da empresa proprietária (para exibição)
    photo_url: '',
    doc_url: '',
    type: 'Residencial',
    sub_type: '',
    has_pool: false,
    has_gym: false,
    has_party_room: false,
    has_playground: false,
    has_sports_court: false,
    has_concierge: false,
    has_laundry: false,
    has_coworking: false,
    has_hvac: false,
    has_balcony: false,
    has_service_area: false,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isApiLoading, setIsApiLoading] = useState(false); // Para o carregamento da API de CEP
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [proprietariaOptions, setProprietariaOptions] = useState([]);

  useEffect(() => {
    if (empreendimento) {
      setFormData({
        name: empreendimento.name || '',
        description: empreendimento.description || '',
        status: empreendimento.status || 'lancamento',
        address_zip_code: empreendimento.address_zip_code || '',
        address_street: empreendimento.address_street || '',
        address_number: empreendimento.address_number || '',
        address_complement: empreendimento.address_complement || '',
        neighborhood: empreendimento.neighborhood || '',
        city: empreendimento.city || '',
        state: empreendimento.state || '',
        country: empreendimento.country || 'Brasil',
        total_area: empreendimento.total_area || '',
        private_area: empreendimento.private_area || '',
        suites: empreendimento.suites || '',
        bedrooms: empreendimento.bedrooms || '',
        bathrooms: empreendimento.bathrooms || '',
        garages: empreendimento.garages || '',
        delivery_date: empreendimento.delivery_date || '',
        price: empreendimento.price || '',
        incorporadora_id: empreendimento.incorporadora_id || null,
        construtora_id: empreendimento.construtora_id || null,
        // Preenche o nome para exibição se o ID existir
        incorporadora_nome: corporateEntities.find(e => e.id === empreendimento.incorporadora_id)?.display_name || empreendimento.incorporadora_nome || '',
        construtora_nome: corporateEntities.find(e => e.id === empreendimento.construtora_id)?.display_name || empreendimento.construtora_nome || '',
        company_proprietaria_id: empreendimento.company_proprietaria_id || null,
        company_proprietaria_name: empreendimento.company_proprietaria_name || '',
        photo_url: empreendimento.photo_url || '',
        doc_url: empreendimento.doc_url || '',
        type: empreendimento.type || 'Residencial',
        sub_type: empreendimento.sub_type || '',
        has_pool: empreendimento.has_pool || false,
        has_gym: empreendimento.has_gym || false,
        has_party_room: empreendimento.has_party_room || false,
        has_playground: empreendimento.has_playground || false,
        has_sports_court: empreendimento.has_sports_court || false,
        has_concierge: empreendimento.has_concierge || false,
        has_laundry: empreendimento.has_laundry || false,
        has_coworking: empreendimento.has_coworking || false,
        has_hvac: empreendimento.has_hvac || false,
        has_balcony: empreendimento.has_balcony || false,
        has_service_area: empreendimento.has_service_area || false,
      });
    }
  }, [empreendimento, corporateEntities]);

  useEffect(() => {
    // Buscar empresas para o campo 'Empresa Proprietária'
    const fetchProprietariaCompanies = async () => {
      const { data, error } = await supabase
        .from('cadastro_empresa')
        .select('id, nome_fantasia, razao_social');

      if (error) {
        console.error('Erro ao buscar empresas proprietárias:', error);
        toast.error('Erro ao carregar lista de empresas.');
      } else {
        setProprietariaOptions(data || []);
      }
    };
    fetchProprietariaCompanies();
  }, [supabase]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCepBlur = useCallback(async (e) => {
    const cep = e.target.value?.replace(/\D/g, '');
    if (cep?.length !== 8) return;

    setMessage('Buscando CEP...');
    setIsApiLoading(true);
    try {
      // Chama sua própria API Route para buscar o CEP
      const response = await fetch(`/api/cep?cep=${cep}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro desconhecido ao buscar CEP.');
      }
      const data = await response.json();

      setFormData((prev) => ({
        ...prev,
        address_street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      }));
      toast.success('Endereço preenchido automaticamente!');
    } catch (error) {
      toast.error(`Erro ao buscar CEP: ${error.message}`);
    } finally {
      setIsApiLoading(false);
      setMessage('');
    }
  }, []);

  const handleCompanySelection = (type, selectedId) => {
    const selectedEntity = corporateEntities.find(entity => entity.id === selectedId);

    if (type === 'incorporadora') {
      setFormData(prev => ({
        ...prev,
        incorporadora_id: selectedEntity ? selectedEntity.id : null,
        incorporadora_nome: selectedEntity ? selectedEntity.display_name : '',
      }));
    } else if (type === 'construtora') {
      setFormData(prev => ({
        ...prev,
        construtora_id: selectedEntity ? selectedEntity.id : null,
        construtora_nome: selectedEntity ? selectedEntity.display_name : '',
      }));
    } else if (type === 'proprietaria') {
        const selectedProprietaria = proprietariaOptions.find(opt => opt.id === selectedId);
        setFormData(prev => ({
            ...prev,
            company_proprietaria_id: selectedProprietaria ? selectedProprietaria.id : null,
            company_proprietaria_name: selectedProprietaria ? (selectedProprietaria.nome_fantasia || selectedProprietaria.razao_social) : '',
        }));
    }
  };

  const onDropPhoto = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    const { data, error } = await supabase.storage
      .from('empreendimento-photos')
      .upload(`public/${file.name}_${Date.now()}`, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      toast.error(`Erro ao fazer upload da foto: ${error.message}`);
    } else {
      const { data: { publicUrl } } = supabase.storage.from('empreendimento-photos').getPublicUrl(data.path);
      setFormData((prev) => ({ ...prev, photo_url: publicUrl }));
      toast.success('Foto enviada com sucesso!');
    }
    setLoading(false);
  }, [supabase]);

  const { getRootProps: getRootPropsPhoto, getInputProps: getInputPropsPhoto } = useDropzone({
    onDrop: onDropPhoto,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg'] },
    multiple: false,
  });

  const onDropDoc = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setLoading(true);
    const { data, error } = await supabase.storage
      .from('empreendimento-docs')
      .upload(`public/${file.name}_${Date.now()}`, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      toast.error(`Erro ao fazer upload do documento: ${error.message}`);
    } else {
      const { data: { publicUrl } } = supabase.storage.from('empreendimento-docs').getPublicUrl(data.path);
      setFormData((prev) => ({ ...prev, doc_url: publicUrl }));
      toast.success('Documento enviado com sucesso!');
    }
    setLoading(false);
  }, [supabase]);

  const { getRootProps: getRootPropsDoc, getInputProps: getInputPropsDoc } = useDropzone({
    onDrop: onDropDoc,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Prepara os dados para envio, garantindo que IDs nulos sejam tratados corretamente
    const dataToSubmit = {
        ...formData,
        total_area: parseFloat(formData.total_area) || null,
        private_area: parseFloat(formData.private_area) || null,
        suites: parseInt(formData.suites) || null,
        bedrooms: parseInt(formData.bedrooms) || null,
        bathrooms: parseInt(formData.bathrooms) || null,
        garages: parseInt(formData.garages) || null,
        price: parseFloat(formData.price) || null,
        // Garante que os campos de nome, se o ID for usado, sejam sincronizados ou removidos se não forem mais necessários na DB
        // Para compatibilidade, manter por enquanto, mas o ideal é que a DB use apenas os IDs
        incorporadora_nome: corporateEntities.find(e => e.id === formData.incorporadora_id)?.display_name || '',
        construtora_nome: corporateEntities.find(e => e.id === formData.construtora_id)?.display_name || '',
        company_proprietaria_name: proprietariaOptions.find(opt => opt.id === formData.company_proprietaria_id)?.nome_fantasia || '',
    };

    const { error } = await supabase
      .from('empreendimentos')
      .upsert(empreendimento ? { id: empreendimento.id, ...dataToSubmit } : dataToSubmit);

    if (error) {
      toast.error(`Erro ao salvar empreendimento: ${error.message}`);
      setMessage(`Erro: ${error.message}`);
    } else {
      toast.success(`Empreendimento ${empreendimento ? 'atualizado' : 'cadastrado'} com sucesso!`);
      setTimeout(() => {
        router.push('/empreendimentos');
        router.refresh(); // Revalida os dados da lista de empreendimentos
      }, 1500);
    }
    setLoading(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Nome do Empreendimento"
            name="name"
            value={formData.name}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <MenuItem value="lancamento">Lançamento</MenuItem>
              <MenuItem value="em_construcao">Em Construção</MenuItem>
              <MenuItem value="pronto_para_morar">Pronto para Morar</MenuItem>
              <MenuItem value="entregue">Entregue</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Descrição"
            name="description"
            value={formData.description}
            onChange={handleChange}
            fullWidth
            multiline
            rows={3}
          />
        </Grid>

        {/* Informações de Endereço */}
        <Grid item xs={12} sm={4}>
          <TextField
            label="CEP"
            name="address_zip_code"
            value={formData.address_zip_code}
            onChange={handleChange}
            onBlur={handleCepBlur}
            fullWidth
            required
            helperText={isApiLoading ? 'Buscando CEP...' : ''}
            InputProps={{
              endAdornment: isApiLoading ? <CircularProgress size={20} /> : null,
            }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Rua"
            name="address_street"
            value={formData.address_street}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={2}>
          <TextField
            label="Número"
            name="address_number"
            value={formData.address_number}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Complemento"
            name="address_complement"
            value={formData.address_complement}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Bairro"
            name="neighborhood"
            value={formData.neighborhood}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Cidade"
            name="city"
            value={formData.city}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Estado"
            name="state"
            value={formData.state}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="País"
            name="country"
            value={formData.country}
            onChange={handleChange}
            fullWidth
            required
          />
        </Grid>

        {/* Informações da Incorporadora, Construtora e Proprietária */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Incorporadora</InputLabel>
            <Select
              label="Incorporadora"
              name="incorporadora_id" // Agora seleciona o ID
              value={formData.incorporadora_id || ''}
              onChange={(e) => handleCompanySelection('incorporadora', e.target.value)}
            >
              <MenuItem value=""><em>Nenhum</em></MenuItem>
              {corporateEntities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.display_name} ({entity.cnpj})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Construtora</InputLabel>
            <Select
              label="Construtora"
              name="construtora_id" // Agora seleciona o ID
              value={formData.construtora_id || ''}
              onChange={(e) => handleCompanySelection('construtora', e.target.value)}
            >
              <MenuItem value=""><em>Nenhum</em></MenuItem>
              {corporateEntities.map((entity) => (
                <MenuItem key={entity.id} value={entity.id}>
                  {entity.display_name} ({entity.cnpj})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Empresa Proprietária</InputLabel>
            <Select
              label="Empresa Proprietária"
              name="company_proprietaria_id"
              value={formData.company_proprietaria_id || ''}
              onChange={(e) => handleCompanySelection('proprietaria', e.target.value)}
            >
              <MenuItem value=""><em>Nenhum</em></MenuItem>
              {proprietariaOptions.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.nome_fantasia || company.razao_social}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Outras informações do empreendimento */}
        <Grid item xs={12} sm={4}>
          <TextField
            label="Tipo"
            name="type"
            value={formData.type}
            onChange={handleChange}
            fullWidth
            select
            required
          >
            <MenuItem value="Residencial">Residencial</MenuItem>
            <MenuItem value="Comercial">Comercial</MenuItem>
            <MenuItem value="Misto">Misto</MenuItem>
            <MenuItem value="Terreno">Terreno</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Subtipo (Ex: Apartamento, Casa, Sala Comercial)"
            name="sub_type"
            value={formData.sub_type}
            onChange={handleChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            label="Data de Entrega"
            name="delivery_date"
            type="date"
            value={formData.delivery_date}
            onChange={handleChange}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Área Total (m²)"
            name="total_area"
            value={formData.total_area}
            onChange={handleChange}
            type="number"
            fullWidth
            inputProps={{ step: "0.01" }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Área Privativa (m²)"
            name="private_area"
            value={formData.private_area}
            onChange={handleChange}
            type="number"
            fullWidth
            inputProps={{ step: "0.01" }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Preço Sugerido"
            name="price"
            value={formData.price}
            onChange={handleChange}
            type="number"
            fullWidth
            inputProps={{ step: "0.01" }}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Suítes"
            name="suites"
            value={formData.suites}
            onChange={handleChange}
            type="number"
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Quartos"
            name="bedrooms"
            value={formData.bedrooms}
            onChange={handleChange}
            type="number"
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Banheiros"
            name="bathrooms"
            value={formData.bathrooms}
            onChange={handleChange}
            type="number"
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <TextField
            label="Vagas de Garagem"
            name="garages"
            value={formData.garages}
            onChange={handleChange}
            type="number"
            fullWidth
          />
        </Grid>

        {/* Infraestrutura e Lazer (Checkboxes) */}
        <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Infraestrutura e Lazer
            </Typography>
            <Grid container spacing={2}>
                {[
                    { name: 'has_pool', label: 'Piscina' },
                    { name: 'has_gym', label: 'Academia' },
                    { name: 'has_party_room', label: 'Salão de Festas' },
                    { name: 'has_playground', label: 'Playground' },
                    { name: 'has_sports_court', label: 'Quadra Esportiva' },
                    { name: 'has_concierge', label: 'Portaria/Concierge' },
                    { name: 'has_laundry', label: 'Lavanderia' },
                    { name: 'has_coworking', label: 'Coworking' },
                    { name: 'has_hvac', label: 'Ar Condicionado (central)' },
                    { name: 'has_balcony', label: 'Varanda' },
                    { name: 'has_service_area', label: 'Área de Serviço' },
                ].map((feature) => (
                    <Grid item xs={6} sm={4} md={3} key={feature.name}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData[feature.name]}
                                    onChange={handleChange}
                                    name={feature.name}
                                />
                            }
                            label={feature.label}
                        />
                    </Grid>
                ))}
            </Grid>
        </Grid>


        {/* Upload de Imagem e Documento */}
        <Grid item xs={12} sm={6}>
          <Box
            {...getRootPropsPhoto()}
            sx={{
              border: '2px dashed gray',
              padding: 2,
              textAlign: 'center',
              cursor: 'pointer',
              mt: 2,
            }}
          >
            <input {...getInputPropsPhoto()} />
            <Typography>Arraste e solte a foto do empreendimento aqui, ou clique para selecionar.</Typography>
            {formData.photo_url && (
              <Box mt={2}>
                <Typography>Foto selecionada:</Typography>
                <img src={formData.photo_url} alt="Empreendimento" style={{ maxWidth: '100%', height: 'auto' }} />
              </Box>
            )}
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box
            {...getRootPropsDoc()}
            sx={{
              border: '2px dashed gray',
              padding: 2,
              textAlign: 'center',
              cursor: 'pointer',
              mt: 2,
            }}
          >
            <input {...getInputPropsDoc()} />
            <Typography>Arraste e solte o documento do empreendimento aqui, ou clique para selecionar.</Typography>
            {formData.doc_url && (
              <Box mt={2}>
                <Typography>Documento selecionado: <a href={formData.doc_url} target="_blank" rel="noopener noreferrer">Ver Documento</a></Typography>
              </Box>
            )}
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Button type="submit" variant="contained" color="primary" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : (empreendimento ? 'Atualizar Empreendimento' : 'Cadastrar Empreendimento')}
          </Button>
        </Grid>
      </Grid>
      {message && (
        <Typography mt={2} color={message.includes('Erro') ? 'error' : 'success'}>
          {message}
        </Typography>
      )}
    </Box>
  );
}