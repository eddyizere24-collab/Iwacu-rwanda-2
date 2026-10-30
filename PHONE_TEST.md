# PHONE_TEST.md — IWACU RWANDA 2

Iyi ni test ikorerwa kuri telefone gusa. Koresha Preview ya PR #3/feature branch; ntukoreshe Production. Ntushyire hano amazina bwite, nimero za telefone cyangwa coordinates z'urugo rwawe.

1. Fungura Preview muri Chrome, ukande **Menya aho ndi**.
   - Ibyitezwe: hagaragara ibisobanuro bisaba uruhushya rwa Location.
   - Ibyo wohereza: vuga niba ubutumwa bw'uruhushya bwagaragaye.

2. Kanda **Emera**, hanyuma wemere Location muri Android.
   - Ibyitezwe: GPS na network bitangira icyarimwe.
   - Ibyo wohereza: vuga niba Android yemeye Location cyangwa yayanze.

3. Tegereza amasegonda 3 uhereye igihe wemeje Location.
   - Ibyitezwe: igisubizo cya mbere cyangwa prior isobanutse iragaragara; GPS ishobora gukomeza kunoza.
   - Ibyo wohereza: igihe cyagaragaye kuri telefone n'ubwoko bw'igisubizo.

4. Reba Intara, Akarere, Umurenge, Akagari n'Umudugudu.
   - Ibyitezwe: urwego rwo hasi rugaragazwa gusa iyo hari amakuru arushyigikira; score ntifatwa nka probability yapimwe.
   - Ibyo wohereza: urwego rwo hasi rwagaragaye, utanditse aho utuye.

5. Zimya Location muri Android Settings, wongere ukande **Menya aho ndi**.
   - Ibyitezwe: nta dead-end; hagaragara prior isobanuye ko atari GPS y'ubu.
   - Ibyo wohereza: vuga niba wabonye prior, amakuru ya nyuma, cyangwa error.

6. Fungura **Si hano? Hindura**, urebe urutonde rwa Intara.
   - Ibyitezwe: Intara eshanu gusa ku ntangiriro; nta Country row.
   - Ibyo wohereza: vuga niba Intara eshanu zagaragaye.

7. Hitamo Intara, Akarere n'Umurenge.
   - Ibyitezwe: breadcrumbs zerekana inzira; **Subira inyuma** igarura urwego rubanziriza.
   - Ibyo wohereza: vuga niba inzira n'ugusubira inyuma byakoze.

8. Fungura ikarita, wegeranye (zoom) ku mbibi z'Imidugudu.
   - Ibyitezwe: imbibi zigaragara zituruka muri database kandi zifite village ID imwe na /api/locate.
   - Ibyo wohereza: vuga niba imbibi zagaragaye cyangwa niba habonetse error.

9. Kanda polygon y'Umudugudu, hanyuma ukande **Koresha aha hantu**.
   - Ibyitezwe: marker ijya hagati muri polygon; location flow imwe na /api/locate ni yo ikoreshwa.
   - Ibyo wohereza: vuga niba marker yimutse n'uko igisubizo cyagarutse.

10. Kanda **Koporora raporo**, uyipaste mu butumwa bwo gusubiza.
    - Ibyitezwe: raporo irimo signals, accuracy, level, path, percentages/scores, timings na commit SHA.
    - Ibyo wohereza: raporo yose; banza ukuremo amakuru bwite cyangwa coordinates zishobora kukuranga.
