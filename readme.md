## endpoints
 - **POST /up/upload/s** - нужен crypt проекта и sprintId спринта в бади + file 
 - **POST /up/upload/p** - нужен crypt проекта в бади + file 
 - **GET /up/status/p/:crypt** - показывает статус транслейта урны проекта, чей *crypt* в парамсах
 - **GET /up/status/s/:id** - показывает статус транслейта урны спринта, чей *id* в парамсах
 - **GET /up/tkn/p/:crypt** - дает токен + урну проекта, чей *crypt* в парамсах
 - **GET /up/tkn/s/:id** - дает токен + урну спринта, чей *id* в парамсах