CREATE DATABASE IF NOT EXISTS medibook;
USE medibook;
CREATE TABLE users(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(15),
  role ENUM('patient','doctor','admin') NOT NULL);
CREATE TABLE doctors(
  user_id INT PRIMARY KEY,
  specialization VARCHAR(100),
  fee INT NOT NULL DEFAULT 500,
  qualification VARCHAR(100), experience INT DEFAULT 0,
  clinic_name VARCHAR(120), clinic_address VARCHAR(255), city VARCHAR(60),
  open_time VARCHAR(5) DEFAULT '10:00', close_time VARCHAR(5) DEFAULT '17:00',
  work_days VARCHAR(40) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat', slot_mins INT DEFAULT 30,
  bio VARCHAR(500),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE appointments(
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL, doctor_id INT NOT NULL,
  appt_date DATE NOT NULL, appt_time VARCHAR(5) NOT NULL,
  reason VARCHAR(255), amount INT,
  status ENUM('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  paid TINYINT DEFAULT 0, order_id VARCHAR(60), payment_id VARCHAR(100),
  FOREIGN KEY(patient_id) REFERENCES users(id),
  FOREIGN KEY(doctor_id) REFERENCES users(id));
