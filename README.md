# BeautyScan AI 💄

## AI Makeup Product Classification System

BeautyScan AI is an AI-based image classification system developed to identify different types of makeup products from images. The system uses Google Teachable Machine to train the image classification model and TensorFlow.js to perform prediction directly in a web browser.

Users can classify makeup products using either a webcam or an uploaded image.

---

## 🎯 Project Objective

The main objective of BeautyScan AI is to develop a simple and user-friendly web-based AI system that can classify makeup products based on image input.

The project demonstrates the application of Artificial Intelligence, specifically image classification, in a practical web application.

---

## 💄 Product Classes

The system classifies four types of makeup products:

- Lipstick
- Mascara
- Blusher
- Foundation

---

## 🛠️ Technologies Used

- Google Teachable Machine
- TensorFlow.js
- HTML5
- CSS3
- JavaScript
- Git
- GitHub

---

## ✨ Main Features

- AI makeup product classification
- Webcam image scanning
- Upload image for classification
- Prediction result display
- Confidence percentage display
- Real-time prediction
- Reset scan function
- User-friendly web interface

---

## 🤖 How the AI System Works

The system follows these steps:

1. The user starts the webcam or uploads an image.
2. The image is received by the web application.
3. TensorFlow.js loads the trained Teachable Machine model.
4. The image is processed by the AI model.
5. The model predicts the makeup product class.
6. The predicted class and confidence percentage are displayed.

### Input → AI Model → Prediction

```text
Webcam / Uploaded Image
          ↓
     Image Input
          ↓
 TensorFlow.js Model
          ↓
 Image Classification
          ↓
Predicted Class + Confidence
📊 Dataset and Model Training

The dataset consists of images representing four makeup product classes. Images were prepared with variations in product appearance, angle, distance and background.

Two training experiments were conducted using Google Teachable Machine.

Model 1
Class	Image Samples
Lipstick	519
Mascara	652
Blusher	575
Foundation	630
Model 2
Class	Image Samples
Lipstick	643
Mascara	714
Blusher	649
Foundation	734

Model 2 used additional image samples compared with Model 1 to investigate the effect of increasing the training dataset.

🧪 Model Testing

The models were tested using unseen images that were not used during training.

Model 1 Testing
Product	Prediction	Confidence	Result
Mascara	Blusher	80%	Incorrect
Lipstick	Lipstick	95%	Correct
Blusher	Blusher	100%	Correct
Foundation	Mascara	99%	Incorrect

Model 1 correctly classified 2 out of 4 recorded test images.

Model 2 Testing
Product	Prediction	Confidence	Result
Mascara	Mascara	100%	Correct
Lipstick	Lipstick	96%	Correct
Blusher	Blusher	91%	Correct
Foundation	Foundation	78%	Correct

Model 2 correctly classified 4 out of 4 recorded test images.

Note: These results represent the recorded test images used during the project and should not be interpreted as the overall accuracy of the model.

🌐 Web Application

BeautyScan AI is a browser-based application that provides two methods of image input.

Webcam

Users can start the camera and show a makeup product in front of the webcam. The AI model analyzes the camera input and displays the predicted product class and confidence.

Upload Image

Users can upload an image of a makeup product from their device. The image is processed by the AI model and the prediction result is displayed.

📁 Project Structure
BeautyScan-AI/
├── assets/
│   ├── blusher.jpg
│   ├── brushes.jpg
│   ├── foundation.jpg
│   ├── lipstick.jpg
│   ├── mascara.jpg
│   ├── no-product.svg
│   └── powder.jpg
├── index.html
├── script.js
├── style.css
└── README.md

▶️ How to Run
Download or clone this repository.
Open the project folder.
Open index.html using a web browser.
Allow camera permission if the webcam feature is used.
Click START CAMERA or UPLOAD IMAGE.
The system will process the image.
The predicted makeup product and confidence percentage will be displayed.

A local development server such as the Live Server extension in Visual Studio Code can also be used.

🔍 Prediction and Confidence

The system displays the predicted product class together with its confidence percentage.

A confidence threshold is used to help determine whether a prediction should be displayed as a recognised product or as an unknown result.

The confidence value represents the model's prediction confidence for the selected class.

⚠️ Model Limitations

The model may produce incorrect predictions when the input image is significantly different from the training images.

Misclassification can occur because of similarities in:

Product shape
Colour
Packaging
Background
Lighting
Camera angle

These errors were recorded during testing and used to evaluate the limitations of the model.

🤖 AI Code Assistant

AI Code Assistant was used during selected stages of development to assist with coding and troubleshooting.

The generated code was reviewed, tested and modified before being integrated into the BeautyScan AI system.

👩‍💻 Project Information
Information	Details
Project Name	BeautyScan AI
Project Type	AI Image Classification & Application Deployment
Classification Classes	4
AI Platform	Google Teachable Machine
Deployment Technology	TensorFlow.js
Application Type	Web Application

📚 Repository Contents

This repository contains:

Source code
Website interface
Image assets
AI model integration
Project documentation
Testing information
Model experiment information