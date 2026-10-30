# PHONE_TEST.md — IWACU RWANDA 2

Iyi ni igeragezwa rikorerwa kuri telefone gusa. Rikorere kuri preview ya branch imaze kuboneka; ntukoreshe Production mu gihe PR itaremezwa. Ntugashyiremo amazina bwite, nimero za telefone cyangwa coordinates z'urugo rwawe.

1. Fungura preview ya IWACU RWANDA 2 muri Chrome, ukande **Menya aho ndi**.
   - Ibyitezwe: hagaragara ibisobanuro bisaba uruhushya rwa Location.
   - Ibyo wohereza: vuga niba ubutumwa bw'uruhushya bwagaragaye.

2. Kanda **Emera**, hanyuma muri Android ukande **Allow while using the app** cyangwa **Mugihe ukoresha app**.
   - Ibyitezwe: urubuga rutangira GPS na network icyarimwe.
   - Ibyo wohereza: andika niba Android yemeye Location cyangwa yayanze.

3. Tegereza amasegonda 3 uhereye igihe wemeje Location.
   - Ibyitezwe: igisubizo cya mbere cyangwa prior isobanutse bigaragara; GPS ishobora gukomeza kunoza.
   - Ibyo wohereza: uko byagenze n'igihe cyagaragaye kuri telefone.

4. Reba ibisubizo ku rwego rwa Intara, Akarere, Umurenge, Akagari n'Umudugudu.
   - Ibyitezwe: hagaragazwa gusa urwego rufite amakuru; scores za overlap ntizitwa probability yapimwe.
   - Ibyo wohereza: izina ry'urwego rwo hasi rwagaragaye, utanditse aho uba.

5. Subira ku ntangiriro, fungura Android **Settings → Location**, uzimye Location, hanyuma wongere ugerageze.
   - Ibyitezwe: nta dead-end; hagaragazwa prior cyangwa amakuru ya nyuma yemejwe, bisobanuwe ko atari GPS y'ubu.
   - Ibyo wohereza: niba wabonye prior, amakuru ya nyuma, cyangwa ubutumwa bw'ikosa.

6. Fungura **Si hano? Hindura**, urebe urutonde rutangira kuri Intara eshanu.
   - Ibyitezwe: nta Country row; iyo uhisemo Intara hagaragara Uturere, hanyuma Imirenge, Utugari n'Imidugudu.
   - Ibyo wohereza: vuga urwego rwose wagezeho n'aho urutonde rwahagaze niba rutageze ku Mudugudu.

7. Hitamo Intara, Akarere n'Umurenge muri picker.
   - Ibyitezwe: breadcrumbs zerekana inzira wahisemo kandi **Subira inyuma** igusubiza ku rwego rubanziriza.
   - Ibyo wohereza: vuga niba breadcrumbs na back byakoze.

8. Fungura ikarita, kwegera (zoom) kugeza ku rwego rw'imbibi z'Imidugudu zigaragara.
   - Ibyitezwe: polygons zituruka muri database; ID y'umudugudu ihuye na scope_code ikoreshwa na /api/locate.
   - Ibyo wohereza: vuga niba imbibi zagaragaye cyangwa niba habonetse error.

9. Kanda polygon y'Umudugudu ku ikarita, hanyuma ukande **Koresha aha hantu**.
   - Ibyitezwe: marker yimukira hagati muri polygon; coordinate inyuzwa muri location flow imwe na /api/locate.
   - Ibyo wohereza: vuga niba marker yimutse n'uko igisubizo cyagarutse.

10. Ku gisubizo, kanda **Koporora raporo**, hanyuma uyishyire (paste) mu butumwa bwo gusubiza.
    - Ibyitezwe: kopi irimo signals, accuracy, level, path, percentages/scores, timings, flags, dataset version na commit SHA.
    - Ibyo wohereza: raporo yose yagarutse uko yakoporowe; kura gusa coordinates bwite cyangwa amakuru akuranga mbere yo kuyohereza.
