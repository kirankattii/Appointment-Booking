import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from '../models/userModel.js'
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary'
import doctorModel from '../models/doctorModel.js'
import appointmentModel from '../models/appointmentModel.js'
import razorpay from 'razorpay'


// API to register user
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!email || !password || !name) {
      return res.json({ success: false, message: "All fieds are required" })
    }
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Enter a valid email" })
    }

    if (password.length < 8) {
      return res.json({ success: false, message: "Enter a strong password" })
    }

    const salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(password, salt)

    const newData = {
      name, email, password: hashPassword
    }
    const newUser = new userModel(newData)
    const user = await newUser.save()

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

    res.json({ success: true, token })



  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })

  }
}

// API For user login

const loginUser = async (req, res) => {
  try {

    const { email, password } = req.body
    const user = await userModel.findOne({ email })
    if (!user) {
      return res.json({ success: false, message: "User not found" })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

      res.json({ success: true, token })
    } else {
      res.json({ success: false, message: "Invalid credentials" })
    }

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API TO GET USER PROFILE DATA
const getProfile = async (req, res) => {
  try {
    const { userId } = req.body;
    const userData = await userModel.findById(userId).select("-password")

    res.json({ success: true, userData })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

//API to update to user profile
const updateProfile = async (req, res) => {
  try {
    const { userId, name, phone, address, dob, gender } = req.body
    const imageFile = req.file

    if (!name || !phone || !address || !dob || !gender) {
      return res.json({ success: false, message: "Data Missing" })
    }

    await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender })

    if (imageFile) {
      // uploadImage to cloudinary
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
      const imageURL = imageUpload.secure_url
      await userModel.findByIdAndUpdate(userId, { image: imageURL })



    }

    res.json({ success: true, message: "Profile Updated" })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}


// API to book appointment
const bookAppointment = async (req, res) => {
  try {
    const { userId, docId, slotDate, slotTime } = req.body
    const docData = await doctorModel.findById(docId).select('-password')

    if (!docData.available) {
      return res.json({ success: false, message: "Doctor not available" })
    }

    let slots_booked = docData.slots_booked

    // checking for slots availability
    if (slots_booked[slotDate]) {
      if (slots_booked[slotDate].includes(slotTime)) {
        return res.json({ success: false, message: "slot not available" })
      } else {
        slots_booked[slotDate].push(slotTime)
      }
    } else {
      slots_booked[slotDate] = []
      slots_booked[slotDate].push(slotTime)
    }

    const userData = await userModel.findById(userId).select("-password")

    delete docData.slots_booked

    const appointmentData = {
      userId,
      docId,
      userData,
      docData,
      amount: docData.fees,
      slotTime,
      slotDate,
      date: Date.now()

    }

    const newAppointment = new appointmentModel(appointmentData)
    await newAppointment.save()


    // save new slots data in docData
    await doctorModel.findByIdAndUpdate(docId, { slots_booked })

    res.json({ success: true, message: "Appointment Booked" })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}


// API to get user appointments for frontend
const listAppointment = async (req, res) => {
  try {
    const { userId } = req.body
    const appointments = await appointmentModel.find({ userId })

    res.json({ success: true, appointments })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

// API to cancle the appointment
const cancleAppointment = async (req, res) => {
  try {
    const { userId, appointmentId } = req.body
    const appointmentData = await appointmentModel.findById(appointmentId)

    //verify appointment user 
    if (appointmentData.userId !== userId) {
      return res.json({ success: false, message: "unauthorized action" })
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

    // reseasing doctors slot

    const { docId, slotDate, slotTime } = appointmentData

    const doctorData = await doctorModel.findById(docId)

    let slots_booked = doctorData.slots_booked
    slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)
    await doctorModel.findByIdAndUpdate(docId, { slots_booked })
    res.json({ success: true, message: "Appointment cancelled" })

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
})



const paymentRazorpay = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    const appointmentData = await appointmentModel.findById(appointmentId);

    if (!appointmentData || appointmentData.cancelled) {
      return res.json({ success: false, message: "Appointment cancelled or not found" });
    }

    const { docData } = appointmentData;

    if (!docData || !docData.fees) {
      return res.json({ success: false, message: "Doctor's fee not found" });
    }

    const amount = docData.fees * 100;
    const currency = process.env.CURRENCY || "INR"; // Default to INR if not set

    const options = {
      amount,
      currency,
      receipt: appointmentId,
    };


    const order = await razorpayInstance.orders.create(options);

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error in Razorpay Payment:", error);
    res.json({ success: false, message: error.message });
  }
};


// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id } = req.body
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

    if (orderInfo.status === "paid") {
      await appointmentModel.findByIdAndUpdate(orderInfo.receipt, { payment: true })
      res.json({ success: true, message: "Payment Successfull" })
    } else {
      res.json({ success: false, message: "Payment Failed" })
    }

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
}

export { registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointment, cancleAppointment, paymentRazorpay, verifyRazorpay }