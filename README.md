# Safras Bank — versão 1.2.0

Aplicativo demonstrativo em React Native / Expo, com identidade visual preta e dourada.

## Recursos

- Tela de acesso local por pressão prolongada.
- Resumo de conta com opção de ocultar saldo.
- Atalhos de PIX, boleto, empréstimo, recarga e cofrinho.
- Extrato local com filtros de entradas e saídas.
- Perfil, dados demonstrativos e ferramentas de teste.
- Câmera para demonstrar leitura de código e fluxo de verificação.
- Persistência local dos dados com AsyncStorage.

## Gerar o APK pelo GitHub

1. Envie o conteúdo desta pasta para a raiz do repositório `safras-bank`, mantendo `assets/` e `.github/workflows/`.
2. Abra **Actions → Build APK → Run workflow** (ou aguarde o build iniciado por um commit).
3. Quando o workflow terminar, baixe o artefato **SafrasBank-apk**.

## Ferramentas de teste

A senha local da área de ferramentas é `1959`.

## Observação importante

Este projeto é uma simulação de interface. PIX, boletos, empréstimos, recargas, validação facial e saldos são registrados somente no dispositivo. O aplicativo não se conecta a bancos, instituições de pagamento, operadoras ou serviços de autenticação e não movimenta dinheiro real. A tela de câmera não envia nem armazena as imagens capturadas.
