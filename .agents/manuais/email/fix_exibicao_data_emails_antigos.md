# Erro de Ocultação de Ano em E-mails Antigos

## 🚨 O Problema
Na interface de e-mail (listagem em `EmailListPanel.js` e cabeçalho em `EmailViewPanel.js`), mensagens oriundas de caixas de entrada de anos anteriores não exibiam o ano (ex: aparecia apenas `08/02 13:45`). 
Isso abria chance para uma falha grave de usabilidade, onde usuários (como diretores ou time do corporativo) liam resoluções pendentes de anos anteriores, confundindo-as com comunicações do ano atual (devido ao formato *clean* sem ano).

## 🛠️ A Causa
A aplicação utilizava uma máscara estática na injeção da biblioteca `date-fns`:
```javascript
format(new Date(email.date), "dd/MM HH:mm", { locale: ptBR })
```
O formato engessado suprimia forçosamente a informação de ano, independente da data real obtida via banco/IMAP.

## ✅ A Solução (Padrão Studio 57 UI)
Acoplagem de uma condição ternária simples que confronta o ano atrelado no e-mail contra a marca de tempo atual do Client (Navegador). Caso sejam de anos divergentes (*"é antigo"*), injeta-se dinamicamente a máscara estendida.

```jsx
// Antes:
<span className="text-[10px] text-gray-400">
  {format(new Date(email.date), "dd/MM HH:mm", { locale: ptBR })}
</span>

// Depois (Padrão Blindado):
<span className="text-[10px] text-gray-400">
  {new Date(email.date).getFullYear() !== new Date().getFullYear() 
    ? format(new Date(email.date), "dd/MM/yyyy HH:mm", { locale: ptBR }) 
    : format(new Date(email.date), "dd/MM HH:mm", { locale: ptBR })}
</span>
```
> **Lição:** Dados ordenados historicamente mas submetidos a formatação condensada perdem acuracidade situacional em longos fluxos temporais. Se vai compilar histórico, validar o limite trans-anual.
