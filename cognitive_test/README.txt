[폴더 구조]
index.html                  1단계: 언어 선택 (한국어 / Tiếng Việt)
ko/index.html               2단계: 검사 선택 (한국어)
vi/index.html               2단계: 검사 선택 (베트남어)
ko/<검사폴더>/index.html     각 검사 (타이틀 → 지시문 → 문항)
vi/<검사폴더>/index.html
  └ images/title-slide.png  각 검사의 첫 화면 이미지

[수리계산]
ko/math, vi/math 의 index.html 은 기존 파일 그대로입니다.
기존 images 폴더(title-slide.png)를 각각 ko/math/images, vi/math/images 로 복사해 주세요.

[검사 추가 방법]
1) ko/ 와 vi/ 아래에 검사 폴더를 새로 만들고 index.html 과 images/ 를 넣습니다.
2) ko/index.html, vi/index.html 의 <div class="cards"> 안에 한 줄을 추가합니다.
   <a class="card" href="./폴더명/index.html">검사 이름</a>
