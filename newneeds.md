## 获取机构学员列表

**接口地址** `/api/student/findStudentsByInstitution`


**请求方式** `GET`


**consumes** ``


**produces** `["*/*","application/json"]`


**接口描述** `返回结果的具体格式以实际返回为准：{"resultCode": 0,"resultMessage": "操作成功","businessCode": 0,"data": 返回结果集, "userdata": {}}`

**请求参数**

| 参数名称         | 参数说明     |     请求类型 |  是否必须      |  数据类型   |  schema  |
| ------------ | -------------------------------- |-----------|--------|----|--- |
| X-XB-JWT         |      token   |     header        |       true      | string   |      |
            | bindXXTStatus         |      学讯通绑定：Y 已绑定 N 未绑定   |     query        |       false      | string   |      |
            | blCampusId         |      学员校区id   |     query        |       false      | integer   |      |
            | countFetched         |      是否需要返回总记录数，默认true   |     query        |       false      | boolean   |      |
            | createTimeBegin         |      学员创建开始时间 yyyy-MM-dd HH:mm:ss   |     query        |       false      | string   |      |
            | createTimeEnd         |      学员创建结束时间 yyyy-MM-dd HH:mm:ss   |     query        |       false      | string   |      |
            | customerIds         |      客户id 多个用,分隔   |     query        |       false      | string   |      |
            | faceRegistrationStatus         |      人脸登记：Y 已登记 N 未登记   |     query        |       false      | string   |      |
            | fingerInfo         |      指纹绑定：Y 已绑定 N 未绑定   |     query        |       false      | string   |      |
            | gradeId         |      年级id   |     query        |       false      | integer   |      |
            | modifyTimeBegin         |      学员修改开始时间 yyyy-MM-dd HH:mm:ss   |     query        |       false      | string   |      |
            | modifyTimeEnd         |      学员修改结束时间 yyyy-MM-dd HH:mm:ss   |     query        |       false      | string   |      |
            | pageNo         |      页码，从0开始，默认为0   |     query        |       false      | integer   |      |
            | pageSize         |      每页大小，默认20   |     query        |       false      | integer   |      |
            | statusCommonId         |      学员状态id   |     query        |       false      | integer   |      |
            | stuStatus         |      有效状态 : 1 有效 0 无效   |     query        |       false      | integer   |      |
            | studentContact         |      学员电话   |     query        |       false      | string   |      |
            | studentContractType         |      学员合同类型：INTENTION_STUDENT 意向学员 OFFICIAL_STUDENT 正式学员   |     query        |       false      | string   |      |
            | studentId         |      学员id   |     query        |       false      | integer   |      |
            | studentName         |      学员姓名   |     query        |       false      | string   |      |
            | studyManegerId         |      学管师id   |     query        |       false      | integer   |      |
            





**响应状态**

| 状态码         | 说明                             |    schema                         |
| ------------ | -------------------------------- |---------------------- |
| 200         | OK                        |StudentByInstitutionDto                          |
| 401         | Unauthorized                        |                          |
| 403         | Forbidden                        |                          |
| 404         | Not Found                        |                          |




**响应参数**

| 参数名称         | 参数说明                             |    类型 |  schema |
| ------------ | -------------------|-------|----------- |
| bindXXTStatus     |学讯通绑定：Y 已绑定 N 未绑定      |    string   |       |
            | birthday     |生日      |    string   |       |
            | blCampusId     |归属校区      |    integer(int32)   |   integer(int32)    |
            | blCampusName     |归属校区名称      |    string   |       |
            | contact     |联系电话      |    string   |       |
            | createTime     |创建时间      |    string   |       |
            | createUserId     |创建人id      |    integer(int32)   |   integer(int32)    |
            | createUserName     |创建人名称      |    string   |       |
            | customFieldViewBase     |      |    CustomFieldViewBase   |   CustomFieldViewBase    |
            | faceRegistrationStatus     |人脸登记：Y 已登记 N 未登记      |    string   |       |
            | fatherName     |父亲姓名      |    string   |       |
            | fatherPhone     |父亲电话      |    string   |       |
            | fingerInfo     |指纹绑定：Y 已绑定 N 未绑定      |    string   |       |
            | gradeId     |年级      |    integer(int32)   |   integer(int32)    |
            | gradeName     |年级名称      |    string   |       |
            | headerFaceImageUrl     |学员头像地址      |    string   |       |
            | lastCustomerId     |最后关联客户      |    integer(int32)   |   integer(int32)    |
            | lastCustomerName     |最后关联客户名称      |    string   |       |
            | modifyTime     |修改时间      |    string   |       |
            | motherName     |母亲姓名      |    string   |       |
            | motherPhone     |母亲电话      |    string   |       |
            | name     |学员名称      |    string   |       |
            | remark     |备注      |    string   |       |
            | sex     |性别0:女;1:男      |    integer(int32)   |   integer(int32)    |
            | statusCommonId     |学员状态Id      |    integer(int32)   |   integer(int32)    |
            | statusCommonName     |学员状态名称      |    string   |       |
            | stuStatus     |有效状态： 0：无效 1 ： 有效      |    integer(int32)   |   integer(int32)    |
            | studentContractType     |学员合同类型：INTENTION_STUDENT 意向学员 OFFICIAL_STUDENT 正式学员      |    string   |       |
            | studentId     |学员id      |    integer(int32)   |   integer(int32)    |
            | studentNo     |学号      |    string   |       |
            | studyManegerId     |学管师Id      |    integer(int32)   |   integer(int32)    |
            | studyManegerName     |学管师姓名      |    string   |       |
            



**schema属性说明**
  
**CustomFieldViewBase**

| 参数名称         | 参数说明                             |    类型 |  schema |
| ------------ | ------------------|--------|----------- |
| customField1         |     自定义字段1      |  string   |      |
            | customField10         |     自定义字段10      |  string   |      |
            | customField11         |     自定义字段11      |  string   |      |
            | customField12         |     自定义字段12      |  string   |      |
            | customField13         |     自定义字段13      |  string   |      |
            | customField14         |     自定义字段14      |  string   |      |
            | customField15         |     自定义字段15      |  string   |      |
            | customField16         |     自定义字段16      |  string   |      |
            | customField17         |     自定义字段17      |  string   |      |
            | customField18         |     自定义字段18      |  string   |      |
            | customField19         |     自定义字段19      |  string   |      |
            | customField2         |     自定义字段2      |  string   |      |
            | customField20         |     自定义字段20      |  string   |      |
            | customField21         |     自定义字段21      |  string   |      |
            | customField22         |     自定义字段22      |  string   |      |
            | customField23         |     自定义字段23      |  string   |      |
            | customField24         |     自定义字段24      |  string   |      |
            | customField25         |     自定义字段25      |  string   |      |
            | customField26         |     自定义字段26      |  string   |      |
            | customField27         |     自定义字段27      |  string   |      |
            | customField28         |     自定义字段28      |  string   |      |
            | customField29         |     自定义字段29      |  string   |      |
            | customField3         |     自定义字段3      |  string   |      |
            | customField30         |     自定义字段30      |  string   |      |
            | customField31         |     自定义字段31      |  string   |      |
            | customField32         |     自定义字段32      |  string   |      |
            | customField33         |     自定义字段33      |  string   |      |
            | customField34         |     自定义字段34      |  string   |      |
            | customField35         |     自定义字段35      |  string   |      |
            | customField36         |     自定义字段36      |  string   |      |
            | customField37         |     自定义字段37      |  string   |      |
            | customField38         |     自定义字段38      |  string   |      |
            | customField39         |     自定义字段39      |  string   |      |
            | customField4         |     自定义字段4      |  string   |      |
            | customField40         |     自定义字段40      |  string   |      |
            | customField5         |     自定义字段5      |  string   |      |
            | customField6         |     自定义字段6      |  string   |      |
            | customField7         |     自定义字段7      |  string   |      |
            | customField8         |     自定义字段8      |  string   |      |
            | customField9         |     自定义字段9      |  string   |      |
            




**响应示例**


```json
[
	{
		"bindXXTStatus": "",
		"birthday": "",
		"blCampusId": 0,
		"blCampusName": "",
		"contact": "",
		"createTime": "",
		"createUserId": 0,
		"createUserName": "",
		"customFieldViewBase": {
			"customField1": "",
			"customField10": "",
			"customField11": "",
			"customField12": "",
			"customField13": "",
			"customField14": "",
			"customField15": "",
			"customField16": "",
			"customField17": "",
			"customField18": "",
			"customField19": "",
			"customField2": "",
			"customField20": "",
			"customField21": "",
			"customField22": "",
			"customField23": "",
			"customField24": "",
			"customField25": "",
			"customField26": "",
			"customField27": "",
			"customField28": "",
			"customField29": "",
			"customField3": "",
			"customField30": "",
			"customField31": "",
			"customField32": "",
			"customField33": "",
			"customField34": "",
			"customField35": "",
			"customField36": "",
			"customField37": "",
			"customField38": "",
			"customField39": "",
			"customField4": "",
			"customField40": "",
			"customField5": "",
			"customField6": "",
			"customField7": "",
			"customField8": "",
			"customField9": ""
		},
		"faceRegistrationStatus": "",
		"fatherName": "",
		"fatherPhone": "",
		"fingerInfo": "",
		"gradeId": 0,
		"gradeName": "",
		"headerFaceImageUrl": "",
		"lastCustomerId": 0,
		"lastCustomerName": "",
		"modifyTime": "",
		"motherName": "",
		"motherPhone": "",
		"name": "",
		"remark": "",
		"sex": 0,
		"statusCommonId": 0,
		"statusCommonName": "",
		"stuStatus": 0,
		"studentContractType": "",
		"studentId": 0,
		"studentNo": "",
		"studyManegerId": 0,
		"studyManegerName": ""
	}
]
```


