# Relatório de Contas Financeiras Cadastradas (Supabase - Studio 57)

Este documento lista todas as contas financeiras cadastradas no sistema, incluindo os códigos e números de conta esperados nos arquivos OFX, para facilitar o processo de conciliação.

## Contas com Mapeamento OFX Configurado

Estas contas já possuem os campos `codigo_banco_ofx` e `numero_conta_ofx` preenchidos no banco de dados e serão facilmente conciliadas:

| ID | Nome da Conta | Banco (OFX) | Conta (OFX) | Instituição |
|----|---------------|-------------|-------------|-------------|
| 25 | 02 - BANCO DO BRASIL | `001` | `1463-X` | Banco do Brasil |
| 30 | 03 - CAIXA | `0104` | `0005795211342` | Caixa Econômica Federal |
| 28 | 04 - AC CREDI SICOOB | `756` | `29787631-7` | SICOOB |

---

## Contas Correntes (Ainda Sem Mapeamento Exato)

Estas contas são do tipo **Conta Corrente**, mas ainda não possuem preenchimento de ID de banco e conta para conciliação automática via OFX:

| ID | Nome da Conta | Tipo | Instituição | Agência | Conta |
|----|---------------|------|-------------|---------|-------|
| 31 | 01 - CREDIRIODOCE SICOOB | Conta Corrente | SICOOB | 3027 | 105.706-5 |
| 36 | 1.02 - SICOOB AC CREDI ARQUITETURA | Conta Corrente | Sicoob | 4071 | 29743254-0 |
| 42 | 06 - INTER INCORPORAÇÃO | Conta Corrente | INTER | 0001 | 048342306-8 |
| 43 | 1.01 - BANCO INTER ARQUITETURA | Conta Corrente | INTER | 0001 | 6308066-4 |

---

## Outras Contas Cadastradas (Dinheiro, Cartões, Investimentos, etc.)

| ID | Nome da Conta | Tipo | Instituição | Agência | Conta |
|----|---------------|------|-------------|---------|-------|
| 26 | 00 - DINHEIRO - S57 INCORPORAÇÕES | Dinheiro | - | - | - |
| 27 | 0 - CARTÃO - BANCO DO BRASIL OUROCARD SÔNIA | Cartão de Crédito | Banco do Brasil | - | - |
| 29 | 0 - CARTÃO - BANCO DO BRASIL IGOR (0753) | Cartão de Crédito | Banco do Brasil | - | - |
| 32 | 0 - INVESTIMENTOS - CAIXA CDB 95 | Conta Investimento | Caixa Econômica Federal | - | - |
| 33 | 0 - CARTÃO - CAIXA (2399) | Cartão de Crédito | Caixa Econômica Federal | - | - |
| 34 | 0 - CARTÃO - SICOOBCARD AC CREDI (7841) | Cartão de Crédito | SICOOB | - | - |
| 35 | 0 - INVESTIMENTO - SICOOB AC CREDI RDC PROG | Conta Investimento | SICOOB | - | - |
| 40 | 0 - CARTÃO - SICOOB CREDIORIODOCE (6482) | Cartão de Crédito | CREDIORIODOCE | - | - |
| 41 | 05 - ANTECIPAÇÕES CREDIRIODOCE | Passivos | SICOOB | - | - |
| 44 | 1 - CARTÃO INTER S7 ARQUITETURA | Cartão de Crédito | BANCO INTER | - | - |
| 45 | Cartão Teste IA - DELETAR | Cartão de Crédito | Banco Teste | - | - |
| 47 | 1 - CARTÃO SICOOB AC CREDI S57 ARQUITETURA | Cartão de Crédito | SICOOB | - | - |
| 48 | Ativos Imobiliários | Conta de Ativo | - | - | - |

---

## Contas Órfãs Encontradas nos Arquivos OFX (Para Verificação)

Estas contas foram encontradas nos arquivos OFX processados, mas não possuem correspondência direta no sistema. Requerem verificação para saber se são contas antigas, inativas ou se precisam ser cadastradas:

| Banco (OFX) | Conta (OFX) | Instituição | Observações |
|-------------|-------------|-------------|-------------|
| `0104` | `000119588` | Caixa Econômica Federal | Possivelmente conta antiga (Arquivos de 2019-2020) |
| `0104` | `0000000045177` | Caixa Econômica Federal | Aparece em dez/2020 e jan/2021 |
| `0104` | `0000000023022` | Caixa Econômica Federal | Histórico vasto de 2021 a 2024 |
| `0104` | `0005795211458` | Caixa Econômica Federal | Muito parecida com a conta principal `342`. Final `458`. |
| `0341` | `7559994285` | Itaú | Um arquivo isolado |
| `000` | `7564364003796` | SICOOB (Provável) | Mapeado com Banco `000` nos arquivos |
| `000` | `7563027362255` | SICOOB (Provável) | Mapeado com Banco `000` nos arquivos |

*(Gerado automaticamente a partir do banco de dados `vhuvnutzklhskkwbpxdz` e da varredura de OFXs)*
