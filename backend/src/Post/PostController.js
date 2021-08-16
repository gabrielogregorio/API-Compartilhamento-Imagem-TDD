const express = require('express');
const Post = require('./Post');
const router = express.Router()
const DataPosts = require('../factories/dataPosts');
const multerImagePosts = require('../middlewares/multerImagePosts');
const userAuth = require('../middlewares/userAuth');
const Like = require('../Likes/Like')
const Save = require('../Saves/Save');
const Comment = require('../Comment/Comment');
const User = require('../Users/User');
const { processId } = require('../util/textProcess');
require('dotenv/config');

const jwtSecret = process.env.JWT_SECRET


router.post('/postLoadFile', userAuth, multerImagePosts.single('image'), async(req, res) => {
  var user = processId(req.data.id)

  if (user == undefined || user == '') { return res.sendStatus(400) }

  if (req.file) {
    img = req.file['filename']
  } else {
    img = ''
  }

  return res.json({file:img})
})


router.post('/post', userAuth, async(req, res) => {
  let { body, test, img} = req.body;

  let user = processId(req.data.id)
  
  if ( body == '' ||body == undefined || user == undefined || user == '') {
      return res.sendStatus(400)
  }

  if (img == undefined) {
    img = ''
  }
  if (test == undefined) {
    test = false;
  }

  try {
    let newPost = new Post({body, user, test, img});
    var newPostSave = await newPost.save();  
    res.json({_id: newPostSave._id, user})
  } catch(error) {

    res.statusCode = 500;
    res.json({msg: "Usuário não registrado na base de dados!"})
  }
})

router.get('/posts', userAuth, async (req, res) => {
  var user = processId(req.data.id)
  if ( user == undefined || user == '') { return res.sendStatus(400) }

  var userItem = await User.findById({_id:user}).populate('following')
  let ids = DataUsers.Build(userItem).followingIds;
  ids.push(user) // Próprio usuário

  var posts = await Post.find({ 'user':{$in:ids} }).sort({'_id': 'desc'}).populate('user comments likes');

  var saves = await Save.find({user:user});
  var idSavedByUser = []
  saves.forEach(item => {
    idSavedByUser.push(item.post)
  })

  var postFactories = []
  posts.forEach(async post => {
    postFactories.push(DataPosts.Build(post, user, idSavedByUser))
  })

  res.statusCode = 200
  res.json(postFactories) 
})


router.get('/post/:id', userAuth, async (req, res) => {
  var user = processId(req.data.id)
  try {
    var posts = await Post.find({_id:req.params.id}).populate('user comments likes sharePost').exec();
  } catch(error) {
    return res.sendStatus(500)
  }

  if (posts.length == 0) {
    return res.sendStatus(404)
  }

  var saves = await Save.find({user:user});
  var idSavedByUser = []
  saves.forEach(item => {
    idSavedByUser.push(item.post)
  })


  var postFactories = []
  posts.forEach(post => {
    postFactories.push(DataPosts.Build(post, user, idSavedByUser))
  })

  return res.json(postFactories) 
})


router.put('/post/:id', userAuth,  async (req, res) => { 
  var {body, img} = req.body;
  var id = processId(req.params.id)
  var user = processId(req.data.id)
  
  if (
    (body == '' || body == undefined || id == undefined || user == undefined)
    ){
    return res.sendStatus(400);
  }

  var upload = {body}

  if (img != '') {
    upload.img = img
  }

  try {
    await Post.findOneAndUpdate({_id:id, user}, {$set:upload})
    var postNew = await Post.findOne({_id:id, user}).populate('user');
    if (postNew == null || postNew == undefined || postNew.length == 0) {
      return res.sendStatus(403)
    }
    return res.json(DataPosts.Build(postNew, user))
  } catch(error)  {
    return res.sendStatus(500)
  }
})

//precisa testar
router.get('/post/comments/:id', userAuth,  async (req, res) => { 
  var id = processId(req.params.id);
  var comments = await Comment.find({post:id})
  return res.json(comments);
})


router.post('/post/comment/:id', userAuth,  async (req, res) => { 
  var id = processId(req.params.id);
  var user = processId(req.data.id);
  var replie = req.body.replie;
  var text = req.body.text;

  if (text == '' || id == '' || user == '' || id == undefined || user == undefined || text == undefined) {
    return res.sendStatus(400)
  }
    
  try {
    if (replie  != undefined) {
      var newComment = new Comment({post: id, user, text, replie});
      await newComment.save();  

      var originalComment = await Comment.findById({_id:replie})
      originalComment.replies.push(newComment)
      await originalComment.save();
  
      return res.json({id:newComment.id, replie:originalComment._id})  
    } else {
      var newComment = new Comment({post:id, user, text});
      await newComment.save();  
  
      var post = await Post.findById({_id:id})
      post.comments.push(newComment)
      await post.save();
  
      return res.json({id:newComment.id})  
    }
  } catch(error)  {
    return res.sendStatus(500)
  }
})


router.delete('/post/comment/:idComment', userAuth,  async (req, res) => { 
  var id = processId(req.params.idComment)
  var user = processId(req.data.id)

  if ( id == undefined || user == undefined ) {
    return res.sendStatus(400)
  }

  try {
    await Comment.deleteOne({_id:id, user});
    return res.sendStatus(200)
  } catch(error)  {
    return res.sendStatus(500)
  }
})


router.put('/post/comment/:idComment', userAuth,  async (req, res) => { 
  var id = processId(req.params.idComment)
  var user = processId(req.data.id)
  var text = req.body.text;

  if (text == '' || id == '' || user == '' || id == undefined || user == undefined || text == undefined) {
    return res.sendStatus(400)
  }

  try {
    var comment = await Comment.findOneAndUpdate({_id:id, user}, {$set:{text}})
    if (comment == null) {
      return res.sendStatus(404)
    }

    return res.json({oi:'ola'})
  } catch(error)  {
    return res.sendStatus(500)
  }
})

router.post('/post/save/:id', userAuth,  async (req, res) => { 
  var id = processId(req.params.id)
  var user = processId(req.data.id)
  try {
    var saveExists = await Save.findOne({post:id, user:user});
    if (saveExists != null) {
      await Save.deleteOne({post:id, user:user});

      var user = await User.findById({_id:user})
  
      user.saves =user.saves.filter(value => value != `${saveExists._id}`)
      await user.save();
  
      return res.json({includeSave: false})  
    }
  } catch(error) {
    return res.sendStatus(500)
  }

  try {
    var newSave = new Save({post:id, user:user});
    await newSave.save();  

    var user = await User.findById({_id:user})
    user.saves.push(newSave)
    await user.save();

    return res.json({includeSave: true})
  } catch(error)  {
    return res.sendStatus(500)
  }
})

router.get('/post/list/save', userAuth,  async (req, res) => { 
  var user = processId(req.data.id);
  var saves = await Save.find({user:user});
  var idSavedByUser = []
  saves.forEach(item => {
    idSavedByUser.push(item.post)
  })

  var posts = await Post.find({ '_id':{$in:idSavedByUser} }).sort({'_id': 'desc'}).populate('user comments likes');

  var postFactories = []
  posts.forEach(async post => {
    postFactories.push(DataPosts.Build(post, user, idSavedByUser))
  })

  return res.json(postFactories);
})


router.post('/post/like/:id', userAuth,  async (req, res) => { 
  var id = processId(req.params.id);
  var user = processId(req.data.id);
  try {
    var likeExistente = await Like.findOne({post:id, user:user});
    if (likeExistente != null) {
      await Like.deleteOne({post:id, user:user});

      var post = await Post.findById({_id:id})
  
      post.likes = post.likes.filter(value => value != `${likeExistente._id}`)
      await post.save();
  
      return res.json({includeLike: false})  
    }
  } catch(error) {
    return res.sendStatus(500)
  }

  try {
    var newLike = new Like({post:id, user:user});
    await newLike.save();  

    var post = await Post.findById({_id:id})
    post.likes.push(newLike)
    await post.save();

    return res.json({includeLike: true})
  } catch(error)  {
    console.log(error)
    return res.sendStatus(500)
  }
})


// Compartilha um post
router.post('/post/share/:id', userAuth, async(req, res) => {
  var user = processId(req.data.id)
  var idPost = processId(req.params.id)

  // Cria o novo post referenciando o post que será compartilhado
  let newPost = new Post({user, sharePost:idPost});
  var newPostSave = await newPost.save();

  // Ainda é preciso arrumar uma forma de remover
  // essa referência quando o post novo for deletado, porém,
  // não é minha prioridade esse detalhe
  // Atualiza o post original com a referência do novo post
  let sharedPost = await Post.findById({_id:idPost});
  sharedPost.thisReferencesShared.push(newPostSave._id)
  await sharedPost.save()

  res.json({_id: newPostSave._id, user, shared:idPost})
})


router.delete('/post/:id', userAuth, async (req, res) => {
  var id = processId(req.params.id)

  try {
    var resDelete = await Post.deleteOne({_id:id})
    if (resDelete.deletedCount == 1) {
      res.sendStatus(200)
    } else {
      res.sendStatus(404)
    }
  } catch(error ) {
    res.sendStatus(500)
  }
})

router.get('/posts/user/:id', userAuth, async (req, res) => {
  var user = processId(req.params.id)
  var userCall = processId(req.data.id)
  if ( user == undefined ) { return res.sendStatus(400) }

  try {
    var userItem = await User.findById({_id:user}).populate('following')
    let ids = DataUsers.Build(userItem).followingIds;
    ids.push(user) // Próprio usuário
  
    var posts = await Post.find({user:user}).sort({'_id': 'desc'}).populate('user comments likes');
  
    var saves = await Save.find({user:user});
    var idSavedByUser = []
    saves.forEach(item => {
      idSavedByUser.push(item.post)
    })
  
    var postFactories = []
    posts.forEach(async post => {
      postFactories.push(DataPosts.Build(post, userCall, idSavedByUser))
    }) 
  
    res.statusCode = 200
    res.json(postFactories)   
  } catch(error) {
    return res.sendStatus(500)
  }
})

module.exports = router;
