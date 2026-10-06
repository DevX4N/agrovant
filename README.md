# AGROVANT — Inteligência que nasce no campo

Case de portfólio (AJ Solutions Tech): site institucional de uma AgTech **fictícia**. Estático, sem build.

```
index.html             estrutura e conteúdo
thumbnail.html         composição da capa do case (1600x1000)
assets/css/style.css   tokens, layout, responsivo
assets/js/farm.js      gerador de mapas de talhões + dados mockados
assets/js/app.js       interações (dashboard, mapa, chat IA, formulário, GSAP)
```

Rodar: `python -m http.server 4640` → http://localhost:4640

Direção "Cena Orbital": o site é uma passagem de satélite sobre a Fazenda Santa Helena. Troca de banda (Satélite/NDVI/Umidade) reprocessa a foto aérea via filtros SVG com varredura.
Todos os números, depoimento e case são demonstrativos. Fotos: Unsplash (licença livre). `noindex` em meta, robots.txt e vercel.json.
