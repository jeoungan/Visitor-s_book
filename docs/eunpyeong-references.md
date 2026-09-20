# 은평역사한옥박물관 은평마당 시각 참고

2026-09-20 사용자 요청에 따라 Google 이미지에서 “은평역사한옥박물관 은평마당 전통혼례”를 검색하고 실제 예식과 공식 장소 사진을 확인했습니다. 검색어의 전통혼례 표현과 달리 확인한 현장 예식은 현대식 정장·드레스 웨딩이므로, 혼례상·가마·전통 혼례복을 임의로 추가하지 않았습니다.

## 확인한 출처

- [서울시 더아결 공식 시설 안내](https://wedding.seoulwomen.or.kr/facilities/1519): 은평역사한옥박물관 은평마당, 서울 은평구 연서로50길8, 야외 라운지·한옥 조망. 사진에서 회색 석재 바닥, 곡선의 짙은 회색 벽돌 난간, 박물관 지붕 아래 원형 기둥과 북한산·한옥 조망을 확인했습니다.
- [더아결 실제 이용 후기](https://wedding.seoulwomen.or.kr/reviews/5308): 북한산 배경과 한옥 풍경, 지붕이 있는 야외 하객 공간에 대한 이용자 설명입니다. 시설 목록에2025-09-24 후기로 표시됩니다.
- [좋은날 — 은평역사한옥박물관 현장 예식 사진](https://www.instagram.com/p/Dcc_01qkRUM/): Google 이미지에 노출된 실제 예식 사진에서 흰색·초록색 꽃아치와 유리 꽃병, 정장 신랑·흰 드레스 신부·베일·부케를 확인했습니다. 개별 사진 속 인물의 얼굴은 복제하지 않았습니다.

## 앱에 반영한 범위

북한산 화강암 봉우리와 초록 산 능선, 낮게 보이는 한옥 기와지붕, 박물관 테라스·원형 기둥·짙은 벽돌 난간·회색 타일, 흰색/초록색 꽃장식을 픽셀 아트로 재구성했습니다. 실제 건물의 정밀 도면 복제가 아니라 산책 기능에 맞춰 빈 바닥을 넓힌 장면입니다. 일반 하객의 기존 하객룩은 유지했습니다.

장소명이 비슷한 사설 은평한옥마을 예식장(연서로50길7-9)의 목조 한옥 마당 사진은 참고에서 제외했습니다. 시설의 “전통혼례 가능” 문구만으로 특정 예식 복장이나 연출을 단정하지 않았습니다.

## 생성 자산과 프롬프트

내장 image_gen 사용. 외부 사진을 그대로 웹앱 배경에 복사하지 않았습니다.

- 배경: public/assets/eunpyeong-madang.png — docs/eunpyeong-map-prompt.txt
- 최종 커플: public/assets/eunpyeong-couple-lace/sheet-transparent.png — docs/eunpyeong-lace-dress-prompt.txt. 사용자가 선호한 이전 레이스 소매·풍성한 치마 디자인을 복원했습니다.
- 초기 커플 시안 보존: public/assets/eunpyeong-couple/sheet-transparent.png — docs/eunpyeong-couple-prompt.txt
- 6인용 원형 식탁: public/assets/reception-table/sheet-transparent.png — docs/reception-table-prompt.txt. 4개 식탁·24개 의자를 배치하고 보행 경로와 앞뒤 겹침 순서를 공유 좌표로 맞췄습니다.
- 편 손바닥: public/assets/wave-palm.png — docs/wave-palm-prompt.txt

스프라이트의 투명화·크기 정렬에는 generate2dsprite의 결정적 후처리만 사용했습니다. 원본 생성 결과와 pipeline-meta.json도 각 자산 폴더에 보존했습니다.
