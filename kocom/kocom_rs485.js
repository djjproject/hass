/**
 * RS485 Homegateway for Samsung kocom
 * @소스 공개 : Daehwan, Kang
 * @삼성 홈넷용으로 수정 : erita
 * @수정일 2019-01-11
 * @코콤용으로 수정 : True-World
 * @수정일 2019-06-20 Version 2 // 조명 제어 안정화// 보일러 외출 활성화
 * @Serial 에서 Socket 으로 수정 및 보일러 setTemp 에러 해결: djjproject
 * @수정일 2020-04-17
 */
 
const util = require('util');
const net = require('net');
const mqtt = require('mqtt');

// 커스텀 파서
var Transform = require('stream').Transform;
util.inherits(CustomParser, Transform);

const CONST = {
  // SerialPort 전송 Delay(ms)
  sendDelay: 80,

  // SerialPort Scan Delay(ms)  // 보일러 상태 읽기
  scanDelay: 120000,

  // 일괄소등 후 조명 상태 읽기 Delay(ms)
  aswDelay: 1000,
  // MQTT 브로커
  mqttBroker: 'mqtt://127.0.0.1', /// 수정 후 사용
  // MQTT 수신 Delay(ms)
  mqttDelay: 1000*5,

  // 메시지 Prefix 상수
  MSG_PREFIX: [0xaa],

  // 기기별 상태 및 제어 코드(HEX)
  DEVICE_STATE: [
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E00000000000000000000FB0D0D','hex'), power1: 'OFF', power2: 'OFF', power3: 'OFF'}, //상태-00
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E0000ff00000000000000FA0D0D','hex'), power1: 'ON' , power2: 'OFF', power3: 'OFF'}, //상태-01
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E000000ff000000000000FA0D0D','hex'), power1: 'OFF', power2: 'ON' , power3: 'OFF'}, //상태-02
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E0000ffff000000000000F90D0D','hex'), power1: 'ON' , power2: 'ON' , power3: 'OFF'}, //상태-03
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E00000000ff0000000000FA0D0D','hex'), power1: 'OFF', power2: 'OFF', power3: 'ON' }, //상태-04
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E0000ff00ff0000000000F90D0D','hex'), power1: 'ON' , power2: 'OFF', power3: 'ON' }, //상태-05
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E000000ffff0000000000F90D0D','hex'), power1: 'OFF', power2: 'ON' , power3: 'ON' }, //상태-06
    {deviceId: 'Light', subId: '1', stateHex: Buffer.alloc(21,'AA5530BC0001000E0000ffffff0000000000F80D0D','hex'), power1: 'ON' , power2: 'ON' , power3: 'ON' }, //상태-07

    {deviceId: 'Light', subId: '',  stateHex: Buffer.alloc(21,'aa55309c000eff010066ffffffffffffffff380d0d','hex'), power: 'OFF' }, //상태-07
    {deviceId: 'Light', subId: '',  stateHex: Buffer.alloc(21,'aa55309c000eff01006500000000000000003f0d0d','hex'), power: 'ON'  }, //상태-07

    {deviceId: 'Gas',   subId: '',  stateHex: Buffer.alloc(21,'AA5530BC0001002C000200000000000000001B0D0D','hex'), power: 'OFF'}, //상태-06
    {deviceId: 'Gas',   subId: '',  stateHex: Buffer.alloc(21,'AA5530BC0001002C000100000000000000001A0D0D','hex'), power: 'ON' }, //상태-07
    {deviceId: 'Gas',   subId: '',  stateHex: Buffer.alloc(21,'AA5530BD0001002C000200000000000000001C0D0D','hex'), power: 'OFF'}, //상태-06
    {deviceId: 'Gas',   subId: '',  stateHex: Buffer.alloc(21,'AA5530BD0001002C000100000000000000001B0D0D','hex'), power: 'ON' }, //상태-07

    {deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(8,'0001003600001100','hex'), power: 'heat', away: 'OFF', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(8,'0001003600001101','hex'), power: 'heat', away: 'ON', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(8,'0001003600000101','hex'), power: 'off-away', away: 'OFF', setTemp: '', curTemp: ''},  //main room con 없는값
    {deviceId: 'Thermo', subId: '1', stateHex: Buffer.alloc(8,'0001003600000100','hex'), power: 'off', away: 'OFF', setTemp: '', curTemp: ''},

    {deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(8,'0001003601001100','hex'), power: 'heat', away: 'OFF', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(8,'0001003601001101','hex'), power: 'heat', away: 'ON', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(8,'0001003601000101','hex'), power: 'off', away: 'ON', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '2', stateHex: Buffer.alloc(8,'0001003601000100','hex'), power: 'off', away: 'OFF', setTemp: '', curTemp: ''},

    {deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(8,'0001003602001100','hex'), power: 'heat', away: 'OFF', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(8,'0001003602001101','hex'), power: 'heat', away: 'ON', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(8,'0001003602000101','hex'), power: 'off', away: 'ON', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '3', stateHex: Buffer.alloc(8,'0001003602000100','hex'), power: 'off', away: 'OFF', setTemp: '', curTemp: ''},

    {deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(8,'0001003603001100','hex'), power: 'heat', away: 'OFF', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(8,'0001003603001101','hex'), power: 'heat', away: 'ON', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(8,'0001003603000101','hex'), power: 'off', away: 'ON', setTemp: '', curTemp: ''},
    {deviceId: 'Thermo', subId: '4', stateHex: Buffer.alloc(8,'0001003603000100','hex'), power: 'off', away: 'OFF', setTemp: '', curTemp: ''},

    {deviceId: 'Elevator', subId: '', stateHex: Buffer.alloc(21,'aa5530bc0044000100010300000000000000350d0d','hex'), power: 'OFF'}
  ],


  DEVICE_COMMAND: [	  
    {deviceId: 'Light', subId: '2', commandHex: Buffer.alloc(21,'AA5530BC000E0001003A0000000000000000350D0D','hex'), power: 'Read'}, //조명 상태
    {deviceId: 'Gas',  subId: '1', commandHex: Buffer.alloc(21,'AA5530BC002C0001003A0000000000000000530D0D','hex'), power: 'Read'}, //가스 상태

    {deviceId: 'Thermo', subId: '1-1', commandHex: Buffer.alloc(21,'AA5530BC00360001003A00000000000000005D0D0D','hex'), power: 'Read'}, //거실 보일러 상태
    {deviceId: 'Thermo', subId: '2-1', commandHex: Buffer.alloc(21,'AA5530BC00360101003A00000000000000005E0D0D','hex'), power: 'Read'}, //거실 보일러 상태
    {deviceId: 'Thermo', subId: '3-1', commandHex: Buffer.alloc(21,'AA5530BC00360201003A00000000000000005F0D0D','hex'), power: 'Read'}, //거실 보일러 상태
    {deviceId: 'Thermo', subId: '4-1', commandHex: Buffer.alloc(21,'AA5530BC00360301003A0000000000000000600D0D','hex'), power: 'Read'}, //거실 보일러 상태

    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(21,'aa5530bc000e000100000000000000000000fb0d0d','hex'), power1: 'OFF'}, //거실1--off
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(21,'aa5530bc000e00010000ff00000000000000fa0d0d','hex'), power1: 'ON' }, //거실1--on
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(21,'aa5530bc000e000100000000000000000000fb0d0d','hex'), power2: 'OFF'}, //거실2--off
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(21,'aa5530bc000e0001000000ff000000000000fa0d0d','hex'), power2: 'ON' }, //거실2--on
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(21,'aa5530bc000e000100000000000000000000fb0d0d','hex'), power3: 'OFF'}, //거실3--off
    {deviceId: 'Light', subId: '1', commandHex: Buffer.alloc(21,'aa5530bc000e000100000000ff0000000000fa0d0d','hex'), power3: 'ON' }, //거실3--on

    {deviceId: 'Light', subId: '', commandHex: Buffer.alloc(21,'aa55309c000eff010066ffffffffffffffff380d0d','hex'), power: 'OFF'}, //일괄소등--off
    {deviceId: 'Light', subId: '', commandHex: Buffer.alloc(21,'aa55309c000eff01006500000000000000003f0d0d','hex'), power: 'ON' }, //일괄소등--on

    {deviceId: 'Gas',   subId: '',  commandHex: Buffer.alloc(21,  'AA5530BC002C0001000200000000000000001B0D0D','hex'), power: 'OFF'}, //가스-off	

    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(21, 'AA5530BC0036000100001100000000000000340D0D','hex'), power: 'heat' }, // 온도조절기1-on 거실
    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(21, 'AA5530BC0036000100001101000000000000350D0D','hex'), away: 'ON' }, // 온도조절기1-away
    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(21, 'AA5530BC0036000100001100000000000000340D0D','hex'), away: 'OFF'}, // 온도조절기1-off ==> Main은 외출취소시 난방으로 돌아감
    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(21, 'AA5530BC0036000100000100000000000000240D0D','hex'), power: 'off'}, // 온도조절기1-off

    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(21, 'AA5530BC0036010100001100000000000000350D0D','hex'), power: 'heat' }, // 온도조절기2-on 안방
    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(21, 'AA5530BC0036010100001101000000000000360D0D','hex'), away: 'ON' }, // 온도조절기2-away
    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(21, 'AA5530BC0036010100001100000000000000350D0D','hex'), away: 'OFF' }, // 온도조절기2-외출 OFF 안방
    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(21, 'AA5530BC0036010100000100000000000000250D0D','hex'), power: 'off'}, // 온도조절기2-off

    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(21, 'AA5530BC0036020100001100000000000000360D0D','hex'), power: 'heat' }, // 온도조절기3-on 안방
    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(21, 'AA5530BC0036020100001101000000000000370D0D','hex'), away: 'ON' }, // 온도조절기3-away
    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(21, 'AA5530BC0036020100001100000000000000360D0D','hex'), away: 'OFF' }, // 온도조절기3-외출 OFF 안방
    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(21, 'AA5530BC0036020100000100000000000000260D0D','hex'), power: 'off'}, // 온도조절기3-off

    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(21, 'AA5530BC0036030100001100000000000000370D0D','hex'), power: 'heat' }, // 온도조절기4-on 안방
    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(21, 'AA5530BC0036030100001101000000000000380D0D','hex'), away: 'ON' }, // 온도조절기4-away
    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(21, 'AA5530BC0036030100001100000000000000370D0D','hex'), away: 'OFF' }, // 온도조절기4-외출 OFF 안방
    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(21, 'AA5530BC0036030100000100000000000000270D0D','hex'), power: 'off'}, // 온도조절기4-off

    {deviceId: 'Thermo', subId: '1', commandHex: Buffer.alloc(21, 'AA5530BC0036000100001100000000000000ff0D0D','hex'), setTemp: ''}, // 온도조절기1-온도설정
    {deviceId: 'Thermo', subId: '2', commandHex: Buffer.alloc(21, 'AA5530BC0036010100001100000000000000ff0D0D','hex'), setTemp: ''},
    {deviceId: 'Thermo', subId: '3', commandHex: Buffer.alloc(21, 'AA5530BC0036020100001100000000000000ff0D0D','hex'), setTemp: ''},
    {deviceId: 'Thermo', subId: '4', commandHex: Buffer.alloc(21, 'AA5530BC0036030100001100000000000000ff0D0D','hex'), setTemp: ''},

    {deviceId: 'Elevator', subId: '', commandHex: Buffer.alloc(21,'AA5530BC0001004400010000000000000000320D0D','hex'), power: 'ON'}
  ],
  
  // 상태 Topic (/kocom/${deviceId}${subId}/${property}/state/ = ${value})
  // 명령어 Topic (/kocom/${deviceId}${subId}/${property}/command/ = ${value})
  TOPIC_PRFIX: 'kocom',
  STATE_TOPIC: 'kocom/%s%s/%s/state', //상태 전달
  DEVICE_TOPIC: 'kocom/+/+/command' //명령 수신

};


//////////////////////////////////////////////////////////////////////////////////////
// 삼성 홈넷용 시리얼 통신 파서 : 메시지 길이나 구분자가 불규칙하여 별도 파서 정의
function CustomParser(options) {
	if (!(this instanceof CustomParser))
		return new CustomParser(options);
	Transform.call(this, options);
	this._queueChunk = [];
	this._msgLenCount = 0;
	this._msgLength = 21;
	this._msgTypeFlag = false;
}

CustomParser.prototype._transform = function(chunk, encoding, done) {
	var start = 0;
	for (var i = 0; i < chunk.length; i++) {
		if(CONST.MSG_PREFIX.includes(chunk[i])) {			// 청크에 구분자(MSG_PREFIX)가 있으면
			this._queueChunk.push( chunk.slice(start, i) );	// 구분자 앞부분을 큐에 저장하고
			this.push( Buffer.concat(this._queueChunk) );	// 큐에 저장된 메시지들 합쳐서 내보냄
			this._queueChunk = [];	// 큐 초기화
			this._msgLenCount = 0;
			start = i;
		} 			
		this._msgLenCount++;
	}
	// 구분자가 없거나 구분자 뒷부분 남은 메시지 큐에 저장
	this._queueChunk.push(chunk.slice(start));
	
	// 메시지 길이를 확인하여 다 받았으면 내보냄
	if(this._msgLenCount >= this._msgLength) {
		this.push( Buffer.concat(this._queueChunk) );	// 큐에 저장된 메시지들 합쳐서 내보냄
		this._queueChunk = [];	// 큐 초기화
		this._msgLenCount = 0;
	}
	
	done();
};
//////////////////////////////////////////////////////////////////////////////////////


// 로그 표시 
var log = (...args) => console.log('[' + new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'}) + ']', args.join(' '));

//////////////////////////////////////////////////////////////////////////////////////
// 홈컨트롤 상태
var homeStatus = {};
var lastReceive = new Date().getTime();
var lastSend = new Date().getTime();
var allSWSend = new Date().getTime();
var mqttReady = false;
var queue = new Array();
var queueSent = new Array();
var status_flag = true;
var allsw_flag = false;
var light_status = ['','',''];
//////////////////////////////////////////////////////////////////////////////////////
// MQTT-Broker 연결
const client  = mqtt.connect(CONST.mqttBroker, {clientId: 'kocom_WallPAD'});
client.on('connect', () => {
	client.subscribe(CONST.DEVICE_TOPIC, (err) => {if (err) log('MQTT Subscribe fail! -', CONST.DEVICE_TOPIC) });
})

const sock = new net.Socket();

sock.connect('8899', '192.168.0.60', function() {
	log('Success connect server');
});

const parser = sock.pipe(new CustomParser());


//////////////////////////////////////////////////////////////////////////////////////
// 홈넷에서 SerialPort로 상태 정보 수신
parser.on('data', function (data) {
	// console.log('Receive interval: ', (new Date().getTime())-lastReceive, 'ms ->', data.toString('hex'));
	lastReceive = new Date().getTime();
	log('[Raw] Received:', data.toString('hex'));
	var receive_check = 0;
	receive_check = (data[0] + data[1] + data[2] + data[3] +  data[4] + data[5] +  data[6] + data[7] + data[8] + data[9] + data[10] + data[11] + data[12] + data[13] +  data[14] + data[15] +  data[16] + data[17] + 0x01) & 0xff;
	if( (receive_check != data[18]) || (data[0] != 0xaa) || (data[1] != 0x55) ){
		log('[Error] error checksum ', receive_check);
		return;
	}
	var receive_tmp = data.slice(4,17);
	// ACK받으면 처리 안함
	if( data[5] != 0x01 ){
		// 일괄소등 예외처리 // 일과소등은 상대메세지와 커멘드가 동일해서 상태처리를 위해 예외처리ㅣ
		if( (data[5] == 0x0e) && (data[6] == 0xff) ){
			var objFound = CONST.DEVICE_STATE.find(obj => data.equals(obj.stateHex));
			if(objFound){
				updateStatus(objFound);
				// 조명상태 확인 및 업데이트
				allSWSend = new Date().getTime();
				allsw_flag = true;
			}
		}
   	    // Elevator 도착정보 
		else if( data[5] == 0x44 ){
			var objFound = CONST.DEVICE_STATE.find(obj => data.equals(obj.stateHex));
			if(objFound){
				updateStatus(objFound);
			}
		}
		else{
			log('[true-world] Data is Command or ACK(Gate2Device)');
		}
		return;
	}

	var ack = '';
	switch (data[7]) {
		case 0x0E: 	// 조명 상태 정보
			if(data[9]==0x3a){
				log('[true-world] Success Receive Light Read command ACK');
				break;
			}
			objFound = CONST.DEVICE_STATE.find(obj => obj.stateHex.includes(receive_tmp));
			if(objFound)
				updateStatus(objFound);

			// Ack 수신 시 큐 삭제//
			ack = Buffer.alloc(9,'000E00010000ffffff','hex');
			ack[6] = data[10];
			ack[7] = data[11];
			ack[8] = data[12];

			var objFoundIdx = queue.findIndex(obj => obj.commandHex.includes(ack));
			if(objFoundIdx > -1) {
				log('[true-world] Success Receive Light command ACK');
				queue.splice(objFoundIdx, 1);
			}

			break;
		case 0x2C:  // 가스 제어기 정보
			if(data[9]==0x3a){
				log('[true-world] Success Receive Gas Read command ACK');
				break;
			}
			objFound = CONST.DEVICE_STATE.find(obj => obj.stateHex.includes(receive_tmp));
			if(objFound)
				updateStatus(objFound);

			// Ack 수신 시 큐 삭제//
			ack = Buffer.alloc(5,'002C000100','hex');
			var objFoundIdx = queue.findIndex(obj => obj.commandHex.includes(ack));
			if(objFoundIdx > -1) {
				log('[Serial] Success Receive Gas command ACK');
				queue.splice(objFoundIdx, 1);
			}

			break;
		case 0x36: 	// 온도조절기 상태 정보
			if(data[9]==0x3a){
				log('[Serial] Success Receive boiller Read command ACK');
				break;
			}
			var objFound = CONST.DEVICE_STATE.find(obj => data.includes(obj.stateHex));	// 메시지 앞부분 매칭(온도부분 제외)
				if(objFound) {
					objFound.setTemp = data[12].toString();		// 설정 온도
					objFound.curTemp = data[14].toString();		// 현재 온도
					updateStatus(objFound);
				}		
			// Ack 수신 시 큐 삭제//
			switch (data[8]) {
				case 0x00:  // 거실
					ack = Buffer.alloc(5,'0036000100','hex');
				break;
				case 0x01:  // 안방
					ack = Buffer.alloc(5,'0036010100','hex');
				break;
				case 0x02:  // 방2
					ack = Buffer.alloc(5,'0036020100','hex');
				break;
				case 0x03:  // 방3
					ack = Buffer.alloc(5,'0036030100','hex');
				break;
			}
			var objFoundIdx = queue.findIndex(obj => obj.commandHex.includes(ack));
			if(objFoundIdx > -1) {
				log('[true-world] Success Receive boillercommand ACK');
				queue.splice(objFoundIdx, 1);
			}
			break;
	}
	
});

//////////////////////////////////////////////////////////////////////////////////////
// MQTT로 HA에 상태값 전송

var updateStatus = (obj) => {
	var arrStateName = Object.keys(obj);
	// 상태값이 아닌 항목들은 제외 [deviceId, subId, stateHex, commandHex, sentTime]
	const arrFilter = ['deviceId', 'subId', 'stateHex', 'commandHex', 'sentTime'];
	arrStateName = arrStateName.filter(stateName => !arrFilter.includes(stateName));
	
	// 상태값별 현재 상태 파악하여 변경되었으면 상태 반영 (MQTT publish)
	arrStateName.forEach( function(stateName) {
		// 상태값이 없거나 상태가 같으면 반영 중지
		var curStatus = homeStatus[obj.deviceId+obj.subId+stateName];
		if((obj[stateName] == null || obj[stateName] === curStatus) && (obj.deviceId != 'Thermo')){
			log('[true-world][Sync] Same:', obj.deviceId+obj.subId+stateName);
			return;
		}
		// 미리 상태 반영한 device의 상태 원복 방지
		if(queue.length > 0) {
			var found = queue.find(q => q.deviceId+q.subId === obj.deviceId+obj.subId && q[stateName] === curStatus);
			if(found != null) return;
		}
		// 0도 미반영  // HA 그래프 오류 방지
		if( (obj.deviceId == 'Thermo') && (obj[stateName] == 0) ){
			return;
		}
		// 상태 반영 (MQTT publish)
		homeStatus[obj.deviceId+obj.subId+stateName] = obj[stateName];
		var topic = util.format(CONST.STATE_TOPIC, obj.deviceId, obj.subId, stateName);
		//조명 1 상태 저장
		if( (obj.deviceId == 'Light') && (obj.subId == '1')){
			if( stateName == 'power1'){
				light_status[0] = obj[stateName];
			}
			else if( stateName == 'power2'){
				light_status[1] = obj[stateName];
			}
			else if( stateName == 'power3'){
				light_status[2] = obj[stateName];
			}
		}
		client.publish(topic, obj[stateName], {retain: true});
		log('[MQTT] Send to HA:', topic, '->', obj[stateName]);
	});
}

//////////////////////////////////////////////////////////////////////////////////////
// HA에서 MQTT로 제어 명령 수신
client.on('message', (topic, message) => {
	if(mqttReady) {
		var topics = topic.split('/');
		var value = message.toString(); // message buffer이므로 string으로 변환
		var objFound = null;
		var objFound1 = null;
		if(topics[0] === CONST.TOPIC_PRFIX) {
			// 온도설정 명령의 경우 모든 온도를 Hex로 정의해두기에는 많으므로 온도에 따른 시리얼 통신 메시지 생성
			if(topics[2]==='setTemp') {
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === topics[1] && obj.hasOwnProperty('setTemp'));
				objFound.commandHex[12] = Number(value);
				objFound.setTemp = String(Number(value)); // 온도값은 소수점이하는 버림
				var addSum = objFound.commandHex[0] + objFound.commandHex[1] + objFound.commandHex[2] + objFound.commandHex[3] + objFound.commandHex[4] + objFound.commandHex[5] + objFound.commandHex[6] + objFound.commandHex[7] + objFound.commandHex[8] + objFound.commandHex[9] + objFound.commandHex[10] + objFound.commandHex[11] + objFound.commandHex[12] + objFound.commandHex[13] + objFound.commandHex[14] + objFound.commandHex[15] + objFound.commandHex[16] + objFound.commandHex[17] + 0x01;
				objFound.commandHex[18] = addSum; // 마지막 Byte는 XOR SUM
			} 
			// 조명1은 기존 조명값과 합쳐서 전송
			else if(topics[1]==='Light1'){
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === topics[1] && obj[topics[2]] === value);				
				if(topics[2]==='power1'){
					light_status[0] = value;
					if( light_status[1] == 'ON'){
						objFound.commandHex[11] = 0xff;
					}
					else{
						objFound.commandHex[11] = 0x00;
					}
					if( light_status[2] == 'ON'){
						objFound.commandHex[12] = 0xff;
					}
					else{
						objFound.commandHex[12] = 0x00;
					}
				}
				else if(topics[2]==='power2'){
					light_status[1] = value;
					if( light_status[0] == 'ON'){
						objFound.commandHex[10] = 0xff;
					}
					else{
						objFound.commandHex[10] = 0x00;
					}
					if( light_status[2] == 'ON'){
						objFound.commandHex[12] = 0xff;
					}
					else{
						objFound.commandHex[12] = 0x00;
					}
				}
				else if(topics[2]==='power3'){
					light_status[2] = value;
					if( light_status[0] == 'ON'){
						objFound.commandHex[10] = 0xff;
					}
					else{
						objFound.commandHex[10] = 0x00;
					}
					if( light_status[1] == 'ON'){
						objFound.commandHex[11] = 0xff;
					}
					else{
						objFound.commandHex[11] = 0x00;
					}
				}
				addSum = objFound.commandHex[0] + objFound.commandHex[1] + objFound.commandHex[2] + objFound.commandHex[3] + objFound.commandHex[4] + objFound.commandHex[5] + objFound.commandHex[6] + objFound.commandHex[7] + objFound.commandHex[8] + objFound.commandHex[9] + objFound.commandHex[10] + objFound.commandHex[11] + objFound.commandHex[12] + objFound.commandHex[13] + objFound.commandHex[14] + objFound.commandHex[15] + objFound.commandHex[16] + objFound.commandHex[17] + 0x01;
				objFound.commandHex[18] = addSum; // 마지막 Byte는 XOR SUM
			}
			// Elevator OFF기능
			else if(topics[1]==='Elevator' && value == 'OFF'){
				client.publish('kocom/Elevator/power/state', 'OFF', {retain: true});
			}			
			// 다른 명령은 미리 정의해놓은 값을 매칭
			else {
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === topics[1] && obj[topics[2]] === value);
			}
		}
		
		if(objFound == null) {
			log('[MQTT] Receive Unknown Msg.: ', topic, ':', value);
			return;
		}
		
		// 현재 상태와 같으면 Skip
		if(value === homeStatus[objFound.deviceId+objFound.subId+objFound[topics[2]]]) {
			//log('[MQTT] Receive & Skip: ', topic, ':', value);
		} 
		// Serial메시지 제어명령 전송 & MQTT로 상태정보 전송
		else {
			// 최초 실행시 딜레이 없도록 sentTime을 현재시간 보다 sendDelay만큼 이전으로 설정
			objFound.sentTime = (new Date().getTime())-CONST.sendDelay;
			queue.push(objFound);	// 실행 큐에 저장
			updateStatus(objFound); // 처리시간의 Delay때문에 미리 상태 반영
		}
	}
})

//////////////////////////////////////////////////////////////////////////////////////
// SerialPort로 제어 명령 전송

const commandProc = () => {
	// 기존 홈넷 RS485 메시지와 충돌하지 않도록 Delay를 줌
	var delay = (new Date().getTime())-lastReceive;
	var sdelay = (new Date().getTime())-lastSend;
	var allswdelay = (new Date().getTime())-allSWSend;
	if(delay < CONST.sendDelay) return;
	
	// 큐에 처리할 메시지가 없으면 룸콘 스캔, // 초기 실행시 초기값 스캔
	if(queue.length == 0){
		var objFound = null;
		if(status_flag == true){
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Gas1');
			queue.push(objFound);
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Light2');
			queue.push(objFound);
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo1-1');
			queue.push(objFound);
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo2-1');
			queue.push(objFound);
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo3-1');
			queue.push(objFound);
			objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo4-1');
			queue.push(objFound);
			status_flag = false;
			lastSend = new Date().getTime();
		}
		else{
			if(sdelay > CONST.scanDelay){			
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo1-1');
				queue.push(objFound);
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo2-1');
				queue.push(objFound);
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo3-1');
				queue.push(objFound);
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Thermo4-1');
				queue.push(objFound);
				lastSend = new Date().getTime();
			}
			if( (allsw_flag == true) && (allswdelay > CONST.aswDelay) ){
				objFound = CONST.DEVICE_COMMAND.find(obj => obj.deviceId+obj.subId === 'Light2');
				queue.push(objFound);
				allsw_flag = false;
			}
			return;
		}
	}


	// 큐에서 제어 메시지 가져오기
	var obj = queue.shift();
	sock.write(obj.commandHex, (err) => {if(err)  return log('[Serial] Send Error: ', err.message); });
	lastReceive = new Date().getTime();
	obj.sentTime = lastReceive;	// 명령 전송시간 sentTime으로 저장
	log('[Serial] Send to Dev:', obj.deviceId, obj.subId, '->', obj.state, obj.power, '('+delay+'ms) ', obj.commandHex.toString('hex'));
	
	// 다시 큐에 저장하여 Ack 메시지 받을때까지 반복 실행  // 일괄소등(Light) 아니면 // 일괄소등이면 조명1상태 읽기
	if((obj.deviceId == 'Light') && (obj.subId == '')){
		allSWSend = new Date().getTime();
		allsw_flag = true;
	}
	else{
		//queue.push(obj);
	}
}

setTimeout(() => {mqttReady=true; log('MQTT Ready...')}, CONST.mqttDelay);
setInterval(commandProc, 20);
