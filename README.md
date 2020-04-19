# DJJPROJECT HomeAssistant Backup Repo.

> DEVICE LIST

1. Beelink GT-MiniA (S905X2 4GB 32GB / AndroidOverLinux Platform)
2. Elfin-EW11 (for RS485 <--> TCP/IP)
3. Kocom Wallpad (KHN-Q100LT, also known as LWT-46XX series)
4. Xiaomi Air Purifier 2S
5. Dawon Wifi Outlet (not yet integrated)

> SOFTWARE DEPENDENCIES

1. python3 for HomeAssistant Core
2. nodejs for kocom_rs485.js
3. mosquitto for MQ Server
4. Google Cloud Platform for Google Assistant Integration



# HISTORY

> 20200417

1. first backup
2. [kocom_rs485] add socket option, fix setTemp error.

> 20200418

1. [kocom_rs485] add power outlet control, realtime state check through rs485 ack data.
2. [HA] add power outlet control, add server resource info.

> 20200419

1. fix XiaoMi MiAir2S set speed on Favorite Mode.

# SCREENSHOTS

![Alt text](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=http%3A%2F%2Fcfile23.uf.tistory.com%2Fimage%2F99C8D0425E9AAF1927526B)

![Alt text](https://img1.daumcdn.net/thumb/R1280x0/?scode=mtistory2&fname=http%3A%2F%2Fcfile2.uf.tistory.com%2Fimage%2F995B154F5E9C5FA0268DCE)
