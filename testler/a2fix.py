# Gerçek 2026 Jolpica verisi (WebFetch ile okunan özet) — test fikstürü
CAL_TXT = """1|Australian Grand Prix|2026-03-08|04:00:00Z|albert_park|Australia|FirstPractice=2026-03-06T01:30:00Z SecondPractice=2026-03-06T05:00:00Z ThirdPractice=2026-03-07T01:30:00Z Qualifying=2026-03-07T05:00:00Z
2|Chinese Grand Prix|2026-03-15|07:00:00Z|shanghai|China|FirstPractice=2026-03-13T03:30:00Z SprintQualifying=2026-03-13T07:30:00Z Sprint=2026-03-14T03:00:00Z Qualifying=2026-03-14T07:00:00Z
3|Japanese Grand Prix|2026-03-29|05:00:00Z|suzuka|Japan|FirstPractice=2026-03-27T02:30:00Z SecondPractice=2026-03-27T06:00:00Z ThirdPractice=2026-03-28T02:30:00Z Qualifying=2026-03-28T06:00:00Z
4|Miami Grand Prix|2026-05-03|20:00:00Z|miami|USA|FirstPractice=2026-05-01T16:00:00Z SprintQualifying=2026-05-01T20:30:00Z Sprint=2026-05-02T16:00:00Z Qualifying=2026-05-02T20:00:00Z
5|Canadian Grand Prix|2026-05-24|20:00:00Z|villeneuve|Canada|FirstPractice=2026-05-22T16:30:00Z SprintQualifying=2026-05-22T20:30:00Z Sprint=2026-05-23T16:00:00Z Qualifying=2026-05-23T20:00:00Z
6|Monaco Grand Prix|2026-06-07|13:00:00Z|monaco|Monaco|FirstPractice=2026-06-05T11:30:00Z SecondPractice=2026-06-05T15:00:00Z ThirdPractice=2026-06-06T10:30:00Z Qualifying=2026-06-06T14:00:00Z
7|Barcelona Grand Prix|2026-06-14|13:00:00Z|catalunya|Spain|FirstPractice=2026-06-12T11:30:00Z SecondPractice=2026-06-12T15:00:00Z ThirdPractice=2026-06-13T10:30:00Z Qualifying=2026-06-13T14:00:00Z
8|Austrian Grand Prix|2026-06-28|13:00:00Z|red_bull_ring|Austria|FirstPractice=2026-06-26T11:30:00Z SecondPractice=2026-06-26T15:00:00Z ThirdPractice=2026-06-27T10:30:00Z Qualifying=2026-06-27T14:00:00Z
9|British Grand Prix|2026-07-05|14:00:00Z|silverstone|UK|FirstPractice=2026-07-03T11:30:00Z SprintQualifying=2026-07-03T15:30:00Z Sprint=2026-07-04T11:00:00Z Qualifying=2026-07-04T15:00:00Z
10|Belgian Grand Prix|2026-07-19|13:00:00Z|spa|Belgium|FirstPractice=2026-07-17T11:30:00Z SecondPractice=2026-07-17T15:00:00Z ThirdPractice=2026-07-18T10:30:00Z Qualifying=2026-07-18T14:00:00Z
11|Hungarian Grand Prix|2026-07-26|13:00:00Z|hungaroring|Hungary|FirstPractice=2026-07-24T11:30:00Z SecondPractice=2026-07-24T15:00:00Z ThirdPractice=2026-07-25T10:30:00Z Qualifying=2026-07-25T14:00:00Z
12|Dutch Grand Prix|2026-08-23|13:00:00Z|zandvoort|Netherlands|FirstPractice=2026-08-21T10:30:00Z SprintQualifying=2026-08-21T14:30:00Z Sprint=2026-08-22T10:00:00Z Qualifying=2026-08-22T14:00:00Z
13|Italian Grand Prix|2026-09-06|13:00:00Z|monza|Italy|FirstPractice=2026-09-04T10:30:00Z SecondPractice=2026-09-04T14:00:00Z ThirdPractice=2026-09-05T10:30:00Z Qualifying=2026-09-05T14:00:00Z
14|Spanish Grand Prix|2026-09-13|13:00:00Z|madring|Spain|FirstPractice=2026-09-11T11:30:00Z SecondPractice=2026-09-11T15:00:00Z ThirdPractice=2026-09-12T10:30:00Z Qualifying=2026-09-12T14:00:00Z
15|Azerbaijan Grand Prix|2026-09-26|11:00:00Z|baku|Azerbaijan|FirstPractice=2026-09-24T08:30:00Z SecondPractice=2026-09-24T12:00:00Z ThirdPractice=2026-09-25T08:30:00Z Qualifying=2026-09-25T12:00:00Z
16|Bahrain Grand Prix in Malaysia|2026-10-04|07:00:00Z|sepang|Malaysia|FirstPractice=2026-10-02T04:30:00Z SecondPractice=2026-10-02T08:00:00Z ThirdPractice=2026-10-03T04:30:00Z Qualifying=2026-10-03T08:00:00Z
17|Singapore Grand Prix|2026-10-11|12:00:00Z|marina_bay|Singapore|FirstPractice=2026-10-09T08:30:00Z SprintQualifying=2026-10-09T12:30:00Z Sprint=2026-10-10T09:00:00Z Qualifying=2026-10-10T13:00:00Z
18|United States Grand Prix|2026-10-25|20:00:00Z|americas|USA|FirstPractice=2026-10-23T17:30:00Z SecondPractice=2026-10-23T21:00:00Z ThirdPractice=2026-10-24T17:30:00Z Qualifying=2026-10-24T21:00:00Z
19|Mexico City Grand Prix|2026-11-01|20:00:00Z|rodriguez|Mexico|FirstPractice=2026-10-30T18:30:00Z SecondPractice=2026-10-30T22:00:00Z ThirdPractice=2026-10-31T17:30:00Z Qualifying=2026-10-31T21:00:00Z
20|Brazilian Grand Prix|2026-11-08|17:00:00Z|interlagos|Brazil|FirstPractice=2026-11-06T15:30:00Z SecondPractice=2026-11-06T19:00:00Z ThirdPractice=2026-11-07T14:30:00Z Qualifying=2026-11-07T18:00:00Z
21|Las Vegas Grand Prix|2026-11-22|04:00:00Z|vegas|USA|FirstPractice=2026-11-20T00:30:00Z SecondPractice=2026-11-20T04:00:00Z ThirdPractice=2026-11-21T00:30:00Z Qualifying=2026-11-21T04:00:00Z
22|Qatar Grand Prix|2026-11-29|16:00:00Z|losail|Qatar|FirstPractice=2026-11-27T13:30:00Z SecondPractice=2026-11-27T17:00:00Z ThirdPractice=2026-11-28T14:30:00Z Qualifying=2026-11-28T18:00:00Z
23|Abu Dhabi Grand Prix|2026-12-06|13:00:00Z|yas_marina|UAE|FirstPractice=2026-12-04T09:30:00Z SecondPractice=2026-12-04T13:00:00Z ThirdPractice=2026-12-05T10:30:00Z Qualifying=2026-12-05T14:00:00Z"""
def takvim():
    out=[]
    for l in CAL_TXT.split("\n"):
        r,ad,d,t,c,ulke,ses=l.split("|")
        k={"season":"2026","round":r,"raceName":ad,"date":d,"time":t,"Circuit":{"circuitId":c,"circuitName":c,"Location":{"locality":c,"country":ulke,"lat":"0","long":"0"}}}
        for kv in ses.split(" "):
            n,v=kv.split("="); dd,tt=v.split("T"); k[n]={"date":dd,"time":tt}
        out.append(k)
    return out
W="""1|RUS|Russell|Mercedes|1|1:23:06.801
2|ANT|Antonelli|Mercedes|1|1:33:15.607
3|ANT|Antonelli|Mercedes|1|1:28:03.403
4|ANT|Antonelli|Mercedes|1|1:33:19.273
5|ANT|Antonelli|Mercedes|2|1:28:15.758
6|ANT|Antonelli|Mercedes|1|2:23:31.243
7|HAM|Hamilton|Ferrari|2|1:32:28.105
8|RUS|Russell|Mercedes|1|1:26:37.979
9|LEC|Leclerc|Ferrari|2|1:27:11.335
10|ANT|Antonelli|Mercedes|1|1:24:42.479
11|NOR|Norris|McLaren|1|1:39:56.180
12|NOR|Norris|McLaren|1|2:04:44.859
13|ANT|Antonelli|Mercedes|19|1:51:15.281
14|ANT|Antonelli|Mercedes|2|1:34:23.754
15|RUS|Russell|Mercedes|1|1:38:02.143
16|VER|Verstappen|Red Bull|1|1:47:14.808"""
P2="""1|ANT|Antonelli|Mercedes|+2.974
2|RUS|Russell|Mercedes|+5.515
3|PIA|Piastri|McLaren|+13.722
4|NOR|Norris|McLaren|+3.264
5|HAM|Hamilton|Ferrari|+10.768
6|HAM|Hamilton|Ferrari|+6.271
7|RUS|Russell|Mercedes|+19.561
8|VER|Verstappen|Red Bull|+1.611
9|RUS|Russell|Mercedes|+0.427
10|LEC|Leclerc|Ferrari|+1.952
11|VER|Verstappen|Red Bull|+15.080
12|ANT|Antonelli|Mercedes|+11.536
13|RUS|Russell|Mercedes|+3.857
14|VER|Verstappen|Red Bull|+4.351
15|VER|Verstappen|Red Bull|+0.196
16|ANT|Antonelli|Mercedes|+2.307"""
P3="""1|LEC|Leclerc|Ferrari|+15.519
2|HAM|Hamilton|Ferrari|+25.267
3|LEC|Leclerc|Ferrari|+15.270
4|PIA|Piastri|McLaren|+27.092
5|VER|Verstappen|Red Bull|+11.276
6|HAD|Hadjar|Red Bull|+23.394
7|NOR|Norris|McLaren|+23.719
8|ANT|Antonelli|Mercedes|+1.986
9|HAM|Hamilton|Ferrari|+0.772
10|VER|Verstappen|Red Bull|+11.586
11|ANT|Antonelli|Mercedes|+18.728
12|RUS|Russell|Mercedes|+15.906
13|VER|Verstappen|Red Bull|+14.718
14|NOR|Norris|McLaren|+5.089
15|HAD|Hadjar|Red Bull|+10.704
16|HAM|Hamilton|Ferrari|+4.919"""
POLE="""1|RUS|Russell|Mercedes
2|ANT|Antonelli|Mercedes
3|ANT|Antonelli|Mercedes
4|ANT|Antonelli|Mercedes
5|RUS|Russell|Mercedes
6|ANT|Antonelli|Mercedes
7|RUS|Russell|Mercedes
8|RUS|Russell|Mercedes
9|ANT|Antonelli|Mercedes
10|ANT|Antonelli|Mercedes
11|NOR|Norris|McLaren
12|NOR|Norris|McLaren
13|GAS|Gasly|Alpine F1 Team
14|NOR|Norris|McLaren
15|RUS|Russell|Mercedes
16|VER|Verstappen|Red Bull"""
SPR={2:("RUS","Russell","Mercedes"),4:("NOR","Norris","McLaren"),5:("RUS","Russell","Mercedes"),9:("ANT","Antonelli","Mercedes"),12:("RUS","Russell","Mercedes")}
def drv(k,f): return {"driverId":f.lower(),"code":k,"givenName":"","familyName":f}
def row(pos,k,f,t,grid,time,status="Finished"):
    return {"position":str(pos),"positionText":str(pos),"Driver":drv(k,f),"Constructor":{"name":t},"grid":str(grid),"laps":"50","status":status,"Time":{"time":time}}
def tbl(txt): return [l.split("|") for l in txt.split("\n")]
CAL=takvim()
def yarisAd(r): return next(c["raceName"] for c in CAL if c["round"]==str(r))
def sonuc1(): 
    return {int(r):row(1,k,f,t,g,tm) for r,k,f,t,g,tm in tbl(W)}
def sonuc2(): return {int(r):row(2,k,f,t,"2",tm) for r,k,f,t,tm in tbl(P2)}
def sonuc3(): return {int(r):row(3,k,f,t,"3",tm) for r,k,f,t,tm in tbl(P3)}
def pole(): return {int(r):row(1,k,f,t,"1","") for r,k,f,t in tbl(POLE)}
def sprint(): return {r:row(1,k,f,t,"1","20:00.000") for r,(k,f,t) in SPR.items()}

TAM = {}
TAM[13] = """1 | 1 | ANT | Antonelli | Mercedes | 19 | 53 | Finished | 1:51:15.281 | 1 (lap 53, 1:23.504)
2 | 2 | RUS | Russell | Mercedes | 2 | 53 | Finished | +3.857 | 4 (lap 51, 1:24.390)
3 | 3 | VER | Verstappen | Red Bull | 5 | 53 | Finished | +14.718 | 2 (lap 37, 1:24.242)
4 | 4 | NOR | Norris | McLaren | 8 | 53 | Finished | +19.056 | 5 (lap 48, 1:24.864)
5 | 5 | PIA | Piastri | McLaren | 6 | 53 | Finished | +19.253 | 8 (lap 45, 1:25.125)
6 | 6 | HAM | Hamilton | Ferrari | 4 | 53 | Finished | +24.655 | 9 (lap 23, 1:25.300)
7 | 7 | GAS | Gasly | Alpine F1 Team | 1 | 53 | Finished | +27.351 | 6 (lap 53, 1:24.927)
8 | 8 | LIN | Lindblad | RB F1 Team | 9 | 53 | Finished | +45.136 | 14 (lap 47, 1:26.028)
9 | 9 | COL | Colapinto | Alpine F1 Team | 7 | 53 | Finished | +47.353 | 7 (lap 53, 1:24.933)
10 | 10 | TSU | Tsunoda | RB F1 Team | 15 | 53 | Finished | +58.187 | 16 (lap 42, 1:26.320)
11 | 11 | BOR | Bortoleto | Audi | 10 | 53 | Finished | +1:05.187 | 15 (lap 31, 1:26.188)
12 | 12 | HUL | Hülkenberg | Audi | 12 | 53 | Finished | +1:06.187 | 3 (lap 53, 1:24.364)
13 | 13 | SAI | Sainz | Williams | 13 | 53 | Finished | +1:14.117 | 12 (lap 46, 1:25.683)
14 | 14 | LAW | Lawson | Red Bull | 22 | 53 | Finished | +1:15.609 | 11 (lap 53, 1:25.578)
15 | 15 | BEA | Bearman | Haas F1 Team | 11 | 53 | Finished | +1:18.958 | 17 (lap 31, 1:26.356)
16 | 16 | OCO | Ocon | Haas F1 Team | 14 | 52 | Lapped | +6.591 | 13 (lap 52, 1:25.711)
17 | 17 | ALB | Albon | Williams | 20 | 52 | Lapped | +20.268 | 10 (lap 52, 1:25.341)
18 | 18 | PER | Pérez | Cadillac F1 Team | 17 | 52 | Lapped | +1:13.372 | 18 (lap 51, 1:26.914)
19 | 19 | BOT | Bottas | Cadillac F1 Team | 16 | 51 | Lapped | +12.880 | 19 (lap 51, 1:27.325)
20 | R | STR | Stroll | Aston Martin | 18 | 26 | Retired | — | 21 (lap 11, 1:28.415)
21 | R | ALO | Alonso | Aston Martin | 21 | 23 | Retired | — | 20 (lap 8, 1:27.961)
22 | R | LEC | Leclerc | Ferrari | 3 | 1 | Retired | — | —"""
TAM[5] = """1 | 1 | ANT | Antonelli | Mercedes | 2 | 68 | Finished | 1:28:15.758 | 1, 68, 1:14.210
2 | 2 | HAM | Hamilton | Ferrari | 5 | 68 | Finished | +10.768 | 3, 61, 1:14.573
3 | 3 | VER | Verstappen | Red Bull | 6 | 68 | Finished | +11.276 | 2, 68, 1:14.398
4 | 4 | LEC | Leclerc | Ferrari | 8 | 68 | Finished | +44.151 | 5, 37, 1:15.297
5 | 5 | HAD | Hadjar | Red Bull | 7 | 67 | Lapped | +5.033 | 4, 67, 1:14.578
6 | 6 | COL | Colapinto | Alpine F1 Team | 10 | 67 | Lapped | +19.510 | 8, 67, 1:15.462
7 | 7 | LAW | Lawson | RB F1 Team | 12 | 67 | Lapped | +34.235 | 10, 59, 1:15.604
8 | 8 | GAS | Gasly | Alpine F1 Team | 14 | 67 | Lapped | +34.572 | 6, 67, 1:15.390
9 | 9 | SAI | Sainz | Williams | 15 | 67 | Lapped | +58.014 | 12, 65, 1:15.852
10 | 10 | BEA | Bearman | Haas F1 Team | 16 | 67 | Lapped | +59.049 | 13, 64, 1:16.002
11 | 11 | PIA | Piastri | McLaren | 4 | 66 | Lapped | +12.699 | 7, 61, 1:15.456
12 | 12 | HUL | Hülkenberg | Audi | 11 | 66 | Lapped | +14.182 | 15, 57, 1:16.275
13 | 13 | BOR | Bortoleto | Audi | 13 | 66 | Lapped | +21.156 | 14, 50, 1:16.221
14 | 14 | OCO | Ocon | Haas F1 Team | 17 | 66 | Lapped | +1:08.635 | 16, 64, 1:16.577
15 | 15 | STR | Stroll | Aston Martin | 22 | 64 | Lapped | +18.397 | 20, 39, 1:18.721
16 | 16 | BOT | Bottas | Cadillac F1 Team | 21 | 64 | Lapped | +53.390 | 19, 59, 1:17.725
17 | R | PER | Pérez | Cadillac F1 Team | 20 | 39 | Retired | | 17, 37, 1:16.915
18 | R | NOR | Norris | McLaren | 3 | 38 | Retired | | 11, 36, 1:15.845
19 | R | RUS | Russell | Mercedes | 1 | 29 | Retired | | 9, 16, 1:15.477
20 | R | ALO | Alonso | Aston Martin | 19 | 23 | Retired | | 21, 10, 1:19.635
21 | R | ALB | Albon | Williams | 18 | 11 | Retired | | 18, 11, 1:17.221
22 | W | LIN | Lindblad | RB F1 Team | 9 | 0 | Did not start | |"""
TAM[1] = """1 | 1 | RUS | Russell | Mercedes | 1 | 58 | Finished | 1:23:06.801 | 6, lap 21, 1:22.670
2 | 2 | ANT | Antonelli | Mercedes | 2 | 58 | Finished | +2.974 | 3, lap 57, 1:22.417
3 | 3 | LEC | Leclerc | Ferrari | 4 | 58 | Finished | +15.519 | 5, lap 38, 1:22.579
4 | 4 | HAM | Hamilton | Ferrari | 7 | 58 | Finished | +16.144 | 4, lap 55, 1:22.423
5 | 5 | NOR | Norris | McLaren | 6 | 58 | Finished | +51.741 | 2, lap 53, 1:22.358
6 | 6 | VER | Verstappen | Red Bull | 20 | 58 | Finished | +54.617 | 1, lap 43, 1:22.091
7 | 7 | BEA | Bearman | Haas F1 Team | 12 | 57 | Lapped | +4.593 | 11, lap 22, 1:24.020
8 | 8 | LIN | Lindblad | RB F1 Team | 9 | 57 | Lapped | +11.816 | 12, lap 21, 1:24.182
9 | 9 | BOR | Bortoleto | Audi | 10 | 57 | Lapped | +12.775 | 8, lap 45, 1:23.257
10 | 10 | GAS | Gasly | Alpine F1 Team | 14 | 57 | Lapped | +29.027 | 15, lap 56, 1:24.486
17 | R | STR | Stroll | Aston Martin | 22 | 43 | Lapped | | 17, lap 36, 1:25.410
18 | R | ALO | Alonso | Aston Martin | 17 | 21 | Retired | | 18, lap 15, 1:25.713
19 | R | BOT | Bottas | Cadillac F1 Team | 19 | 15 | Retired | | 20, lap 8, 1:27.364
20 | R | HAD | Hadjar | Red Bull | 3 | 10 | Retired | | 16, lap 9, 1:25.239
21 | W | PIA | Piastri | McLaren | 5 | 0 | Did not start | |
22 | W | HUL | Hülkenberg | Audi | 11 | 0 | Did not start | |"""
import re as _re
def tam_satirlari(r):
    out=[]
    for l in TAM[r].split("\n"):
        c=[x.strip() for x in l.split("|")]
        x={"position":c[0],"positionText":c[1],"Driver":drv(c[2],c[3]),"Constructor":{"name":c[4]},"grid":c[5],"laps":c[6],"status":c[7]}
        if len(c)>8 and c[8] and c[8]!="—": x["Time"]={"time":c[8]}
        if len(c)>9:
            m=_re.search(r"^(\d+)\D+(\d+)\D+(\d:\d\d\.\d+)",c[9])
            if m: x["FastestLap"]={"rank":m.group(1),"lap":m.group(2),"Time":{"time":m.group(3)}}
        out.append(x)
    return out
