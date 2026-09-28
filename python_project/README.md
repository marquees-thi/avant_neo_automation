# Avant Neo 50W RGB/CCT IoT Automation Suite (Windows 11)

Software modular de baixa latência em Python 3.10+ para controle de alta performance da lâmpada inteligente Avant Neo 50W (base Tuya 3.5), executando em segundo plano na bandeja do sistema do Windows 11 com suporte a sincronização de tela Ambilight, efeitos dinâmicos, atalhos globais Win32 e API REST local.

---

## 1. Características Técnicas

- **Driver Desacoplado:** Fila de comandos `queue.Queue` em thread dedicada. Chamadas de rede TCP da `tinytuya` nunca travam a UI, Ambilight ou atalhos.
- **Protocolo Tuya 3.5 Validado:** Comunicação direta na porta TCP `6668` usando `socketPersistent(False)` e timeout de 2.0s para evitar travamentos de socket.
- **Ambilight de Baixa Latência:** Captura do display primário via `mss` (C-native) com saturação reforçada no espaço HSV e interpolação linear (LERP) a 20 FPS.
- **Atalhos Globais Win32:** Registro via `ctypes.windll.user32.RegisterHotKey` (não interfere em jogos em tela cheia nem consome CPU).
- **Auto-Recovery DHCP:** Mecanismo automático via `tinytuya.deviceScan()` para recuperar a comunicação caso o roteador atribua novo IP.
- **API REST Local:** Servidor FastAPI + Uvicorn em `http://127.0.0.1:21420` para automação via Stream Deck, scripts ou Home Assistant.
- **Bandeja do Windows:** Ícone dinâmico em `pystray` com representação fiel da cor e estado da lâmpada.

---

## 2. Requisitos & Instalação

### Pré-requisitos:
- Windows 10 ou 11 (64-bit)
- Python 3.10 ou superior adicionado ao PATH do Windows

### Instalação das Dependências:
Abra o PowerShell ou Terminal na pasta do projeto e execute:

```powershell
pip install -r requirements.txt
```

---

## 3. Como Executar

### Opção A: Execução Normal (com logs no terminal para depuração)
```powershell
python main.py
```

### Opção B: Execução Silenciosa em Background (sem janela de terminal)
Dê um duplo-clique no arquivo:
```text
start_background.vbs
```
Ou via terminal:
```powershell
pythonw main.py
```

### Opção C: Iniciar Automaticamente com o Windows 11
Dê um duplo clique no script:
```text
install_startup.bat
```
Ele criará o atalho necessário em `shell:startup`.

---

## 4. Teclas de Atalho Padrão (Customizáveis em `config.yaml`)

- `Ctrl + Alt + L`: Ligar / Desligar Lâmpada (Toggle Power)
- `Ctrl + Shift + R`: Modo Leitura (4000K Neutro, 100% Brilho)
- `Ctrl + Alt + A`: Iniciar Ambilight (Sincronização de Tela)
- `Ctrl + Alt + Up`: Aumentar Brilho (+15%)
- `Ctrl + Alt + Down`: Diminuir Brilho (-15%)

---

## 5. Endpoints da API REST Local (Porta 21420)

| Método | Endpoint | Descrição | Exemplo de Uso |
|---|---|---|---|
| `GET` | `/api/status` | Retorna o status da lâmpada, cena ativa e Ambilight | `/api/status` |
| `POST / GET` | `/api/power/toggle` | Alterna entre ligada e desligada | `/api/power/toggle` |
| `POST / GET` | `/api/color/rgb` | Define cor RGB (suporta JSON ou query params) | `/api/color/rgb?r=0&g=255&b=255` |
| `POST / GET` | `/api/color/white` | Define modo branco (brilho 1-100%, temp 0-100%) | `/api/color/white?brightness=100&color_temp=50` |
| `POST / GET` | `/api/scene/start` | Inicia cena (`cyberpunk`, `candle`, `circadian`, `ambilight`) | `/api/scene/start?scene=cyberpunk` |
| `POST / GET` | `/api/scene/stop` | Interrompe efeitos instantaneamente e restaura ao normal | `/api/scene/stop?restore=true` |
