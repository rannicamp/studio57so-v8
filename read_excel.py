import pandas as pd
import sys

file_path = r"C:\Users\ranni\Desktop\Historico_Tabelas_Vendas_Alfa\211013_ALFA - TABELA DE VENDAS.xlsx"

try:
    df = pd.read_excel(file_path, header=0)
    df = df.dropna(subset=[df.columns[1]]) # valid unit rows
    
    # ensure price column is numeric
    df[df.columns[6]] = pd.to_numeric(df[df.columns[6]], errors='coerce')
    
    # find row with minimum price
    min_row = df.loc[df[df.columns[6]].idxmin()]
    
    print("Cheapest Unit:", min_row[df.columns[1]])
    print("Price:", min_row[df.columns[6]])
except Exception as e:
    print(f"Error: {e}")
